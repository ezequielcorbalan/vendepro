# Product Rules — CRM Inmobiliario

## Entities (distinct, never mix states across them)
- Lead: prospect entering the pipeline
- Contact: person in the database (owner, buyer, investor)
- Appraisal (tasacion): property valuation process
- Property: captured listing being commercialized
- Reservation: accepted offer in closing process
- Sale: completed transaction

## Pipeline Flow
lead → contact → appraisal → capture → documentation → publication → reservation → sale

## Business Rules
- Lead must be assigned same day
- Lead must be contacted within 24h
- No response after 7 days = lost
- Appraisal doesn't end at presentation — follow up until captured or lost
- Property can't be published without critical documents
- Calendar events must link to CRM entities
- Every stage change must be logged in stage_history
