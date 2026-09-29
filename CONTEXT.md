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

A membership application moves through these states:

1. `PENDING` — the applicant has submitted the application.
2. `PENDING_PAYMENT` — the application fee is owed, and a payment proof is
   either uploaded or recorded at the office.
3. `APPROVED` or `REJECTED` — the outcome. `APPROVED` is reached automatically
   when the fee is verified; `REJECTED` is a decision made before payment.

**Verifying the application fee is what approves membership.** Once the fee is
verified — whether uploaded as proof or recorded at the office — the applicant
becomes a member and gains member rights immediately. The fee *is* the
membership requirement, so confirming payment is the decision; there is no
separate sign-off to wait for. `PENDING_APPLICATION_REVIEW` is a legacy state
and should no longer be produced.

The fee must be `VERIFIED` and exactly equal the configured fee amount. A short
payment is not a settled fee: membership grants borrowing, supply credit, and
machine access, and none of those are earned in part. The amount is re-read from
the stored payment inside the approval transaction, not taken from the request
body, so a fee recorded at the wrong amount cannot grant membership.

Because approval follows automatically from payment, rejecting an application is
a **pre-payment** action. An application already marked `APPROVED` cannot be
rejected through the review endpoints.

## Account Deactivation and Reactivation

An officer can disable a member's account from the member records workspace.
The `active` flag alone is not enough to explain the decision, so the officer is
prompted to confirm and may give a reason, and that reason is what the member
is shown.

A disabled account keeps its session but loses every API call, so it is
redirected to a notice page rather than a dashboard it cannot use. The redirect
reads the database rather than the session cookie, so deactivating someone
takes effect on their next navigation instead of whenever their token happens
to expire.

From the notice page the member can **request reactivation**, which notifies the
President and Secretary. Only those two roles answer reactivation requests, so
the Treasurer is neither notified nor given the panel — the same pair that the
membership admin workspace already treats as the membership officers. Pending
requests are badged on the member records tab and reactivation closes the
request automatically, so no one has to remember to dismiss it.

There is no column for any of this. State is derived from three audit events —
`MEMBER_DEACTIVATED`, `REACTIVATION_REQUESTED`, `MEMBER_REACTIVATED` — where
the newest decides where the account stands. The audit trail is already the
durable, append-only record of who changed what and why, so the reason lives
there, and a stale column could disagree with the trail. Deriving it means
reactivation cannot be silently forgotten in the UI.

The consequence worth knowing: rejection and deactivation are different tools.
Rejection is a pre-payment decision about an application; deactivation is an
operational action against a member, reversible through this request flow.

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
