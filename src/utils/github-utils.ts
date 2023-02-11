import {createWriteStream} from 'fs'
import * as core from '@actions/core'
import * as github from '@actions/github'
import {GitHub} from '@actions/github/lib/utils'
import type {PullRequest} from '@octokit/webhooks-types'
import * as stream from 'stream'
import {promisify} from 'util'
import got from 'got'

const asyncStream = promisify(stream.pipeline)

export function getCheckRunContext(): {sha: string; runId: number} {
  if (github.context.eventName === 'workflow_run') {
    core.info('Action was triggered by workflow_run: using SHA and RUN_ID from triggering workflow')
    const event = github.context.payload
    if (!event.workflow_run) {
      throw new Error("Event of type 'workflow_run' is missing 'workflow_run' field")
    }
    return {
      sha: event.workflow_run.head_commit.id,
      runId: event.workflow_run.id
    }
  }

  const runId = github.context.runId
  if (github.context.payload.pull_request) {
    core.info(`Action was triggered by ${github.context.eventName}: using SHA from head of source branch`)
    const pr = github.context.payload.pull_request as PullRequest
    return {sha: pr.head.sha, runId}
  }

  return {sha: github.context.sha, runId}
}

export async function downloadArtifact(
  octokit: InstanceType<typeof GitHub>,
  artifactId: number,
  fileName: string,
  token: string
): Promise<void> {
  core.startGroup(`Downloading artifact ${fileName}`)
  try {
    core.info(`Artifact ID: ${artifactId}`)

    const req = octokit.rest.actions.downloadArtifact.endpoint({
      ...github.context.repo,
      artifact_id: artifactId,
      archive_format: 'zip'
    })

    const headers = {
      Authorization: `Bearer ${token}`
    }
    const resp = await got(req.url, {
      headers,
      followRedirect: false
    })

    core.info(`Fetch artifact URL: ${resp.statusCode} ${resp.statusMessage}`)
    if (resp.statusCode !== 302) {
      throw new Error('Fetch artifact URL failed: received unexpected status code')
    }

    const url = resp.headers.location
    if (url === undefined) {
      const receivedHeaders = Object.keys(resp.headers)
      core.info(`Received headers: ${receivedHeaders.join(', ')}`)
      throw new Error('Location header was not found in API response')
    }
    if (typeof url !== 'string') {
      throw new Error(`Location header has unexpected value: ${url}`)
    }

    const downloadStream = got.stream(url, {headers})
    const fileWriterStream = createWriteStream(fileName)

    core.info(`Downloading ${url}`)
    downloadStream.on('downloadProgress', ({transferred}) => {
      core.info(`Progress: ${transferred} B`)
    })
    await asyncStream(downloadStream, fileWriterStream)
  } finally {
    core.endGroup()
  }
}

export async function listFiles(octokit: InstanceType<typeof GitHub>, sha: string): Promise<string[]> {
  core.startGroup('Fetching list of tracked files from GitHub')
  try {
    const commit = await octokit.rest.git.getCommit({
      commit_sha: sha,
      ...github.context.repo
    })
    const files = await listGitTree(octokit, commit.data.tree.sha, '')
    return files
  } finally {
    core.endGroup()
  }
}

async function listGitTree(octokit: InstanceType<typeof GitHub>, sha: string, path: string): Promise<string[]> {
  const pathLog = path ? ` at ${path}` : ''
  core.info(`Fetching tree ${sha}${pathLog}`)
  let truncated = false
  let tree = await octokit.rest.git.getTree({
    recursive: 'true',
    tree_sha: sha,
    ...github.context.repo
  })

  if (tree.data.truncated) {
    truncated = true
    tree = await octokit.rest.git.getTree({
      tree_sha: sha,
      ...github.context.repo
    })
  }

  const result: string[] = []
  for (const tr of tree.data.tree) {
    const file = `${path}${tr.path}`
    if (tr.type === 'blob') {
      result.push(file)
    } else if (tr.type === 'tree' && truncated) {
      const files = await listGitTree(octokit, tr.sha as string, `${file}/`)
      result.push(...files)
    }
  }

  return result
}

export async function postPullRequestComment(
  octokit: InstanceType<typeof GitHub>,
  name: string,
  message: string
): Promise<void> {
  if (github.context.payload?.pull_request?.number) {
    let response
    const previousComments = await listPreviousComments()

    if (!previousComments.length) {
      core.debug(`No previous comments found, creating a new one...`)
      response = await octokit.rest.issues.createComment({
        ...github.context.repo,
        issue_number: github.context.payload.pull_request.number,
        body: getHeader() + message + getFooter()
      })
    } else {
      core.debug(`Previous comment found, updating...`)
      response = await octokit.rest.issues.updateComment({
        ...github.context.repo,
        comment_id: previousComments[0].id,
        body: getHeader() + message + getFooter()
      })
    }

    if (previousComments.length > 1) {
      const surplusComments = previousComments.slice(1)
      if (surplusComments.length) core.debug(`Removing surplus comments. (${surplusComments.length}`)
      for (const comment of surplusComments) {
        await octokit.rest.issues.deleteComment({
          ...github.context.repo,
          comment_id: comment.id
        })
      }
    }
    if (response) {
      core.debug(`Post message status: ${response.status}`)
      core.debug(`Comment URL: ${response.data.url}`)
      core.debug(`Comment HTML: ${response.data.html_url}`)
    }
  }

  async function listPreviousComments(): Promise<IssueComment[]> {
    const per_page = 20
    let results: IssueComment[] = []
    let page = 1
    let response
    if (github.context.payload.pull_request?.number) {
      do {
        response = await octokit.rest.issues.listComments({
          ...github.context.repo,
          issue_number: github.context.payload.pull_request?.number,
          page,
          per_page
        })
        results = [...results, ...response.data]
        page++
      } while (response.data.length === per_page)
    }
    return results.filter(comment => comment.body?.includes(getHeader()))
  }

  function getHeader(): string {
    return `\n<p data-id='${github.context?.payload?.pull_request?.id}' data-name='${name || 'data-name'}'>${
      name || ''
    }</p>\n\n`
  }

  function getFooter(): string {
    return `\n<p>Last Update @ ${new Date().toUTCString()}</p>\n`
  }

  interface IssueComment {
    id: number
    body?: string
    html_url: string
    issue_url?: string
    url: string
  }
}
