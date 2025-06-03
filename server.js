const express = require('express');
const app = express();
const port = 7777;

// Configuration
const FHIR_SERVER = 'http://localhost:8080';
const USERNAME = 'root';
const PASSWORD = 'k5hlhmOYr4';

// Serve static files from public directory
app.use(express.static('public'));

// Create Basic Auth header
const auth = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
const headers = {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json'
};

async function sql(query){
    const startTime = Date.now();
    console.log(`sql: ${query}`)
    const response = await fetch(`${FHIR_SERVER}/$sql`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify([query])
    });
    const resp = await response.json();
    const endTime = Date.now();
    console.log(`SQL query execution time: ${(endTime - startTime) / 1000} seconds`);
    return resp;
}

function layout(body){
     return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to My Web Server</title>
    <!-- Tailwind CSS -->
    <script src="/js/tailwind.min.js"></script>
    <!-- HTMX -->
    <script src="/js/htmx.min.js"></script>
    <!-- Vega-Lite -->
    <script src="/js/vega.min.js"></script>
    <script src="/js/vega-lite.min.js"></script>
    <script src="/js/vega-embed.min.js"></script>
</head>
<body class="p-4">
   <div class="p-4 border-b border-gray-200 mb-4"> <a href="/">Home</a> </div>
   ${body} 
</body>
</html>
`;
}

// Route for the home page
app.get('/', (req, res) => {
    res.send(layout(`
        <div class="bg-gray-50 mx-auto rounded-lg shadow-lg p-8 max-w-md w-full text-center"
             hx-get="/dashboard"
             hx-trigger="load"
             hx-swap="innerHTML"
             >
        <div class="text-2xl font-bold text-gray-800 mb-4">Loading...</div>
    </div>
    `));
});

app.get('/dashboard', async (req, res) => {
    const dashboard = await sql('select gender, count(*) from sof.patient_plus group by 1 limit 10');
    const html = dashboard.map((x)=>{ 
        return `<a class="text-2xl font-bold text-gray-800 block p-4 hover:bg-gray-100 cursor-pointer"
                 href="/patients_by_gender?gender=${x.gender}">${x.gender} ${x.count}</a>`
    }).join('')

    const spec = {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        data: {
            values: dashboard
        },
        mark: 'arc',
        encoding: {
            theta: {field: 'count', type: 'quantitative'},
            color: {field: 'gender', type: 'nominal'}
        },
        selection: {
            gender: {
                type: 'single',
                on: 'click',
                fields: ['gender']
            }
        }
    };

    const vegaHtml = `
        <div id="vis" class="w-full h-96"></div>
        <script>
            vegaEmbed('#vis', ${JSON.stringify(spec)}).then(result => {
                result.view.addEventListener('click', (event, item) => {
                    console.log(event, item);
                    if (item && item.datum) {
                        window.location.href = '/patients_by_gender?gender=' + item.datum.gender;
                    }
                });
            });
        </script>
    `;

    res.send(`<div class="grid grid-cols-1 gap-4">
        <div class="bg-white rounded-lg shadow-lg p-4">
            ${html}
        </div>
        <div class="bg-white rounded-lg shadow-lg p-4">
            ${vegaHtml}
        </div>
    </div>`);
});

app.get('/patients_by_gender', async (req, res) => {
    const gender = req.query.gender;
    const patients = await sql(`select round(age/10)*10 as age, gender, count(*) from sof.patient_plus where gender = '${gender}' group by 1,2 limit 10`);
    const html = patients.map((x)=>{ 
        return `<a href="/patients_by_age?age=${x.age}" class="block p-4 text-gray-800 hover:bg-gray-100 cursor-pointer">${x.age} ${x.gender} ${x.count}</a>`
    }).join('')
    res.send(layout(`<div class="text-gray-800 p-4 bg-white rounded-lg shadow-lg divide-y divide-gray-200">${html}</div>`));
});

app.get('/patients_by_age', async (req, res) => {
    const age = req.query.age;
    const patients = await sql(`select * from sof.patient_plus where age between ${age} and ${age+10} limit 100`);
    const html = patients.map((x)=>{    
        return `<a href="/patient/${x.patient_id}" class="text-gray-800 block p-4 hover:bg-gray-100 cursor-pointer">${JSON.stringify(x)}</a>`
    }).join('')
    res.send(layout(`<div class="text-gray-800 p-4 bg-white rounded-lg shadow-lg divide-y divide-gray-200">${html}</div>`));
});

app.get('/patient/:id', async (req, res) => {
    const id = req.params.id;
    const patient = await sql(`select * from patient where id = '${id}' limit 1`);
    res.send(layout(`<pre class="text-gray-800 text-xs p-4 bg-white rounded-lg shadow-lg divide-y divide-gray-200">
        ${JSON.stringify(patient[0], null, 2)}
     </pre>`));
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
}); 