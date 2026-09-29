# Farmers Cooperative

This context covers cooperative membership, financial assistance, farm supplies,
and shared machinery.

## Language

**Applicant**:
A registered user whose membership application has not yet been approved.

**Member**:
An approved cooperative participant who may request loans, supplies, and
machinery.

**Membership Application**:
An applicant's submitted identity and farm information awaiting a cooperative
decision.
_Avoid_: Registration

**Loan**:
A cash-loan request and, once approved, its continuing financial account.
_Avoid_: Loan application

**Payment**:
A member's submitted claim that money was paid, awaiting verification.
_Avoid_: Loan payment

**Loan Payment**:
A verified ledger entry applied to a loan balance.
_Avoid_: Payment submission

**Supply Transaction**:
A member's request to purchase or borrow a quantity of a farm supply.
_Avoid_: Supply order

**Machine Request**:
A member's request to reserve one machine for a date range.
_Avoid_: Rental

**Audit Entry**:
An immutable record of an actor's domain-changing action.
_Avoid_: Log

**Activity Log**:
A diagnostic record of account activity such as registration, login, or
logout.
_Avoid_: Audit entry

**Notification**:
An in-app message informing one user of a workflow outcome.

## Membership Fee and Approval

A membership application passes through four states, and each is a distinct
decision made by a distinct actor:

1. `PENDING` — the applicant has submitted the application.
2. `PENDING_PAYMENT` — the application fee is owed.
3. `PENDING_APPLICATION_REVIEW` — a verified fee has been recorded and the
   application is waiting on the President.
4. `APPROVED` or `REJECTED` — the President's decision.

**Recording or verifying the application fee is not approving membership.** It
moves the application to `PENDING_APPLICATION_REVIEW` and nothing more. Only the
membership review endpoints grant membership, and they re-verify the fee
themselves inside the approval transaction.

The fee must be `VERIFIED` and exactly equal the configured fee amount. A short
payment is not a settled fee: membership grants borrowing, supply credit, and
machine access, and none of those are earned in part. The check runs inside the
approval transaction, not before it, so a fee reversed in between cannot produce
an approval.

## Money and Time

**Philippine Time**:
The cooperative's business timezone (`Asia/Manila`, UTC+8, no DST). Report
periods, day boundaries, and lateness are all counted in this zone, never in the
server's local zone.
_Avoid_: Local time

Lateness is counted in **elapsed calendar days**, weekends included. A machine
due Friday and returned Monday is three days late, not one.

A loan's due date is fixed when the loan is **approved**, not when it is
requested. The requested term is a proposal; the due date is an obligation.

Supply prices are **frozen when the member submits the request**. The amount
charged at pickup is the quoted figure, even if the product's price is edited
meanwhile.

Receipt numbers are a per-year sequence (`RCP-<year>-<ordinal>`) shared across
payments and loan payments. They are never derived from record contents.

## Supplies and Machinery

Stock is deducted from a supply's quantity when a request is **approved**, not
when it is picked up. Approval reserves the units; rejecting an approved request
releases them. The quantity shown to members is therefore what is available to
order, not a physical warehouse count.

A machine booking must fall entirely within **one harvest season**. A booking
straddling a season boundary would draw on two separate capacity pools, so it is
rejected rather than split. If no seasons are configured the year behaves as a
single pool; the farm-size duration limit still applies either way.

Loan limits and machine capacity are both re-checked at **approval**, not trusted
from request time. A member's farm size or a product's per-hectare limit can
change while a request waits, and the office's decision must reflect the
position at the moment it is made.
