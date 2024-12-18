const { PDFLoader } = require('@langchain/community/document_loaders/fs/pdf');
const { pdfParse } = require('pdf-parse');
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

const extract = async () => {
    const bearer = await axios.post(
        'https://iam.cloud.ibm.com/identity/token',
        `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${process.env.APIKEY}`,
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
    );

    const bearerToken = bearer.data.access_token;

    const loader = new PDFLoader('./public/clown_services_agreement.pdf');
    const docs = await loader.load();
    const content = docs[0].pageContent;

    await axios.post(process.env.URL, {
        project_id: process.env.PROJECTID,
        model_id: "ibm/granite-13b-chat-v2",
        input:`Refer to ${content} and extract title, name of clown, clown services, effective date, and compensation, then transform output into json.`,
        parameters: {
            decoding_method: "greedy",
            max_new_tokens: 900,
            min_new_tokens: 0,
            stop_sequences: [],
            repetition_penalty: 1.05
        },
    }, {
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": "Bearer " + bearerToken
        }
    })
        .then((res) => {
            output = res.data.results[0].generated_text;
        })
        .catch((error) => {
            console.log('error extracting from watsonx: ', error);
        })

        output = output.replace(/`/g, "");
        console.log('output: ', output);

        await axios.post(process.env.URL, {
            project_id: process.env.PROJECTID,
            model_id: "mistralai/mistral-large",
            input:`Refer to ${output} and create a table.`,
            parameters: {
                decoding_method: "greedy",
                max_new_tokens: 900,
                min_new_tokens: 0,
                stop_sequences: [],
                repetition_penalty: 1.05
            },
        }, {
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": "Bearer " + bearerToken
            }
        })
            .then((res) => {
                console.log('formatted table response: ', res.data.results[0].generated_text);
                table = res.data.results[0].generated_text;
            })
            .catch((error) => {
                console.log('error extracting from watsonx: ', error);
            })

            fs.writeFile('./public/agreementSummary.md', table, 'utf-8', (error) => {
                if (error) {
                    console.log('\nerror writing file: ', error);
                } else{
                    console.log('\nfile succesfully written!');
                }    
            });
}

extract();

exports.extract = extract;