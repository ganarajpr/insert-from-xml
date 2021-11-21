require('dotenv').config();
const { MongoClient } = require("mongodb");
const _ = require('lodash');
const fs = require("fs");
const util = require("util");
const glob = require("glob");

const readFile = util.promisify(fs.readFile);
let client;
let db;
const Sanscript = require('@sanskrit-coders/sanscript');
const getDb = async () => {
    if(!client) {
        console.log(process.env.MONGOURL);
        client = new MongoClient(process.env.MONGOURL);
        await client.connect();
        db = client.db(process.env.DB_NAME);
    }
    return db;    
};

const insertBookContents = async (file) => {
    const content = await readFile(file,'utf8');
    const book = getBookName(file);
    const lines = content.split('\n');
    let i = 0;
    let currentLine = [];
    const linesCol = db.collection('lines');
    while ( i < lines.length ) {
        const parts = extractBookContext(lines[i]);
        i++;
        const {context, content, split} = extractLine(lines[i]);
        const finalContext = [...parts,context].join('.');
        const ctn = Sanscript.t(content,'iast', 'devanagari');
        if(split === '//') {
            currentLine.push(ctn);
            const finalLine = currentLine.join('\n');
            console.log(finalContext);
            try {
                await linesCol.insertOne({
                    text: finalLine,
                    language: "sanskrit",
                    script: "devanagari",
                    book,
                    bookContext: finalContext,
                    createdBy: "112183819311352500254",
                    createdAt: new Date(),
                    dcs: true
                });
            } catch(e) {
                console.log(e);
            }
            
            currentLine = [];
        } else {
            currentLine.push(ctn);
        }
        
        i++;
    }
};

const extractBookContext = (id) => {
    return id.replace('R_', '');
};

const run = async () => {
    const db = await getDb();
    const {XMLParser} = require('fast-xml-parser');

    const options = {
        ignoreAttributes : false
    };
    const book = Sanscript.t('Rāmāyaṇa', 'iast', 'hk');
    const parser = new XMLParser(options);
    const ramayana = fs.readFileSync('./sa_rAmAyaNa.xml','utf8');
    let jsonObj = parser.parse(ramayana);
    const kandas = jsonObj.TEI.text.body.div.div;
    const linesCol = db.collection('lines');
    let i = 0;
    while( i< kandas.length) {
        let lg = kandas[i].lg;
        let j = 0;
        while (j<lg.length) {
            const context = extractBookContext(lg[j]['@_xml:id']);
            let k = 0;
            const text = [];
            while(k < lg[j].l.length) {
                //console.log(lg[j].l[k]['#text']);
                if(lg[j].l[k]['#text']) {
                    text.push(Sanscript.t(lg[j].l[k]['#text'], 'iast', 'devanagari'));
                }
                k++;
            }
            if(text.length) {
                console.log(context);
                // console.log(text.join('\n'));
                try {
                    await linesCol.insertOne({
                        text: text.join('\n'),
                        language: "sanskrit",
                        script: "devanagari",
                        book,
                        bookContext: context,
                        createdBy: "112183819311352500254",
                        createdAt: new Date(),
                        gretil: true
                    });
                } catch(e) {
                    console.log(e);
                }
            }
            j++;
        }
        i++;
    }
    // const files = await globPromise('./books/*.txt');
    // console.log(files);
    // const db = await getDb();
    // let j = 0;
    // while(j < files.length) {
    //     await insertBookContents(files[j]);
    //     fs.renameSync(files[j], files[j]+'done');
    //     //console.log(getBookName(files[j]));
    //     j++;        
    // }
    client.close();
};

run();