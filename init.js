// Configuration
const FHIR_SERVER = 'http://localhost:8080';
const USERNAME = 'root';
const PASSWORD = 'k5hlhmOYr4';

// Create Basic Auth header
const auth = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
const headers = {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json'
};

const NUMBER_OF_PATIENTS = 1000;

async function load(resourceType){
    const startTime = Date.now();
    const url = `https://storage.googleapis.com/aidbox-public/synthea/v2/${NUMBER_OF_PATIENTS}/fhir/${resourceType}.ndjson.gz`;
    console.log(`Loading ${resourceType} from ${url}...`);
    const response = await fetch(`${FHIR_SERVER}/fhir/$load`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({"source": url})
    });
    console.log(response.status);
    const responseText = await response.text();
    console.log(resourceType, responseText);
    const endTime = Date.now();
    console.log(`Time taken for ${resourceType}: ${(endTime - startTime) / 1000} seconds`);
}

async function sql(query){
    console.log(`sql: ${query}`)
    const response = await fetch(`${FHIR_SERVER}/$sql`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify([query])
    });
    const responseText = await response.json();
    console.log(response.status, responseText);
}

async function upsert(resource){
    console.log(`create: ${resource.resourceType}`)
    const response = await fetch(`${FHIR_SERVER}/fhir/${resource.resourceType}/${resource.id}`, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify(resource)
    });
    const responseBody = await response.json();
    console.log(response.status, responseBody.resourceType);
}
const startTime = Date.now();

await Promise.all([
    load('Patient'),
    load('Condition'),
    load('Encounter'),
    load('MedicationRequest')
]);

const endTime = Date.now();
console.log(`Time taken: ${(endTime - startTime) / 1000} seconds`);
 
await sql('select count(*) from Patient');
await sql('drop view if exists sof.patient cascade');

await upsert({
    resourceType: 'ViewDefinition',
    id: "patient",
    name: "patient",
    status: "active",
    resource: "Patient",
    select: [
        {
            column: [
                { name: "patient_id", path: "id" },
                { name: "gender", path: "gender" },
                { name: "dob", path: "birthDate" }
            ]
        }
    ]
})


await sql(`
    create or replace view sof.patient_plus  AS 
     select *, DATE_PART('year', AGE(CURRENT_DATE, (dob)::date)) as age 
     from sof.patient
`)

await sql(`
    select count(*) from sof.patient_plus
`)

await upsert({
    resourceType: "ViewDefinition",
    id: "condition",
    status: "active",
    resource: "Condition",
    name: "condition",
    select: [
        {
            column: [
                { name: "condition_id", path: "id" },
                { name: "onset", path: "onset.dateTime" },
                { name: "abatement", path: "abatement.dateTime" },
                { name: "status", path: "clinicalStatus.coding.code.first()" },
                { name: "code", path: "code.coding.where(system='http://snomed.info/sct').code.first()" },
                { name: "display", path: "code.text" },
                { name: "patient_id", path: "subject.id" },
                { name: "category", path: "category.first().coding.display.first()" }
            ]
        }
    ]
})

await upsert({
    resourceType: "ViewDefinition",
    id: "encounter",
    name: "encounter",
    resource: "Encounter",
    status: "active",
    select: [{
        column: [
            { name: "id", path: "id", type: "id" },
            { name: "patient_id", path: "subject.id", type: "id" },
            { name: "period_start", path: "period.start" },
            { name: "period_end", path: "period.end" },
            { name: "class", path: "class.code" },
            { name: "status", path: "status" },
            { name: "type_display", path: "type[0].coding.where(system='http://snomed.info/sct').display" },
            { name: "type_code", path: "type[0].coding.where(system='http://snomed.info/sct').code" }
        ]
    }]
})

await upsert({
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
})