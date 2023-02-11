![Tests failed](https://img.shields.io/badge/tests-5%20passed%2C%205%20failed%2C%201%20skipped-critical)

<details><summary>Open Details</summary>
<p>

## ❌️ <a id='user-content-r0' href='#r0'>fixtures/dotnet-trx.trx</a>
|Total|Passed|Failed|Skipped|Time|
|---:|---:|---:|---:|---:|
|11|5✔️|5❌️|1✖️|1s|

<details><summary>Open Suit Details</summary>
<p>

|Test suite|Passed|Failed|Skipped|Time|
|:---|---:|---:|---:|---:|
|[DotnetTests.XUnitTests.CalculatorTests](#r0s0)|5✅|5❌️|1⚪|118ms|

</p>
</details>


<details><summary>Open Tests Detail</summary>
<p>

#### ❌️ <a id='user-content-r0s0' href='#r0s0'>DotnetTests.XUnitTests.CalculatorTests</a>
```
✅ Custom Name
❌️ Exception_In_TargetTest
	System.DivideByZeroException : Attempted to divide by zero.
❌️ Exception_In_Test
	System.Exception : Test
❌️ Failing_Test
	Assert.Equal() Failure
	Expected: 3
	Actual:   2
✅ Is_Even_Number(i: 2)
❌️ Is_Even_Number(i: 3)
	Assert.True() Failure
	Expected: True
	Actual:   False
✅ Passing_Test
✅ Should be even number(i: 2)
❌️ Should be even number(i: 3)
	Assert.True() Failure
	Expected: True
	Actual:   False
⚪ Skipped_Test
✅ Timeout_Test
```

</p>
</details>


</p>
</details>
