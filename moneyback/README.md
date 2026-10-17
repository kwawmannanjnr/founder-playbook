# MoneyBack AI

React Native (Expo) consumer app for the MoneyBack AI recovery MVP.

The offer is “Check if companies owe you money.” A free scan finds evidence-backed leads. Pro ($14.99/month) and Family ($24.99/month) are the ongoing protection plans. The app imports a sample household or a transaction CSV, detects recurring charges and recovery leads, and walks a case from review to an approved draft. Refunds count only after a matching credit or a refund you confirm. This preview does not contact merchants, move money, or charge a card.

## Run

```bash
cd moneyback
npm install
npm run web
```

`npm test` runs the detection and case-workflow tests. `npm run typecheck` checks TypeScript.

The sample household is Jordan Lee, statement activity through April 16, 2026. Bank linking is simulated and labeled as such.
