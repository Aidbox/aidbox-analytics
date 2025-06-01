# SQL on FHIR analytics example project


## Installation

```bash
docker compose up -d

docker compose log -f
```

This will start the following services:

- PostgreSQL
- Aidbox
- Grafana
- Jupyter


Open http://localhost:8080 and login into aidbox.

### load data and install views

```bash
node init.js
```

Open grafana at http://localhost:3000 and login with admin/admin.


## Create your view

Go to http://localhost:8080/ui/console#/sof 

```json
{
  "resource": "MedicationRequest",
  "id": "medreq",
  "name": "medreq",
  "status": "active",
  "select": [
    {
      "column": [
        {
          "name": "id",
          "path": "id",
          "type": "id"
        },
        {
          "name": "patient_id",
          "path": "subject.id",
          "type": "id"
        },
        {
          "name": "rxnorm_display",
          "path": "medication.ofType(CodeableConcept).coding.where(system='http://www.nlm.nih.gov/research/umls/rxnorm').display"
        },
        {
          "name": "rxnorm_code",
          "path": "medication.ofType(CodeableConcept).coding.where(system='http://www.nlm.nih.gov/research/umls/rxnorm').code"
        },
        {
          "name": "rest",
          "path": "$this"
        }
      ]
    }
  ]
}
```

## Jupyter

Open http://localhost:8888 and open sql-on-fhir notebook.


## Run mini app

```bash
node run dev
open http://localhost:7777
```



