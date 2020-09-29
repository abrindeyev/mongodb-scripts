/*
 *  fuzzer.js
 *  Description: Generate pseudo random test data, with some fuzzing capability
 *  Created by: luke.prochazka@mongodb.com
 */

// Usage: "mongo [+connection options] --quiet fuzzer.js"

// User defiend parameters

let dbName = 'database', collName = 'collection';
let dropPref = true; // drop collection prior to generating data
let x = 5; // number of doc by order of magnitude
let totalDocs = Math.ceil(Math.random() * 10 ** x);
let days = 365; // date range
var fuzzer = {
    _id: "", // default to server generation
    vary_types: false,
    mode: "random", // random, bell, bimodal
    range: "max", // min, max, %
    cardinality: 1, //
    sparsity: 0, //
};
var indexes = [
    // createIndex options document
    // { "oid": { unique: true } },
    { "date": 1 },
    { "location": "2dsphere" },
    { "random": 1 },
    { "timestamp": 1 }
];

// global defaults

var iter = 0, batch = 0, batchSize = 1000, doc = {};
let now = new Date().getTime();
let timestamp = Math.floor(now/1000.0);
if (totalDocs < batchSize) {
    var iter = 1;
    var batchSize = totalDocs;
} else {
    var iter = Math.floor(totalDocs / batchSize);
}
let residual = Math.floor(totalDocs % batchSize);

print('Number batches:', iter, 'plus', residual, 'remainder documents');

/*
 * main
 */

function dropNS(dropPref) {
    return (dropPref ? db.getSiblingDB(dbName).getCollection(collName).drop() : print('Not dropping collection'));
}

function getRandomNumber(min, max) {
    return Math.random() * (max - min) + min;
}

function getRandomInteger(min, max) {
    var min = Math.ceil(min);
    var max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1) + min); // The maximum is inclusive and the minimum is inclusive 
}

function genHexString(len) {
    let output = '';
    for (let i = 0; i < len; ++i) {
        output += (Math.floor(Math.random() * 16)).toString(16);
    }
    return output;
}

function genRandomString(len) {
    let result = '';
    let chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (let i = 0; i < len; ++i) {
       result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function genDoc() {
    /*
     * Generate pseudo-random doc values
     */
    return {
        // "oid": new ObjectId(),
        "string": genRandomString(getRandomInteger(3,24)),
        "object": {
            "str": genRandomString(getRandomInteger(4,12)),
            "num": +getRandomNumber(-1 * 2 ** 12, 2 ** 12).toFixed(4),
            "oid": ObjectId()
        },
        "array": [ "element1", "element2" ],
        "boolean": Math.random() < 0.5,
        "date": new Date(now - (Math.random()*days*24*60*60*1000)),
        "timestamp": new Timestamp(timestamp - (Math.random()*days*24*60*60), 1),
        "null": null,
        "int32": NumberInt(getRandomNumber(-1 * 2 ** 31 - 1, 2 ** 31 - 1)),
        "int64": NumberLong(getRandomNumber(-1 * 2 ** 63 - 1, 2 ** 63 - 1)),
        "double": getRandomNumber(-1 * 2 ** 12, 2 ** 12),
        "decimal128": NumberDecimal(getRandomNumber(-1 * 2 ** 127 - 1, 2 ** 127 - 1)),
        "regex": /\/[0-9a-f]*\//,
        "bin": BinData(0, UUID().base64()),
        "uuid": UUID(),
        "md5": MD5(genHexString(32)),
        "fle": BinData(6, UUID().base64()),
        "location": {
            "type": "Point",
                "coordinates": [
                    +getRandomNumber(-180, 180).toFixed(4),
                    +getRandomNumber(-90, 90).toFixed(4)
                ]
        },
        "random": +getRandomNumber(0, totalDocs).toFixed(4)
    };
}

dropNS(dropPref);

// generate and bulk write the docs
print('Generating:', totalDocs, 'total documents');
for (let i = 0; i < iter; ++i) {
    var bulk = db.getSiblingDB(dbName).getCollection(collName).initializeUnorderedBulkOp();
    while (batch < batchSize) {
        bulk.insert(genDoc());
        ++batch
    }
    result = bulk.execute({ w: 1 });
    batch = 0;
    print('Processing batch', i + 1, 'of', iter, '(' + result.nInserted, 'documents inserted)');
}

if (residual) {
    var bulk = db.getSiblingDB(dbName).getCollection(collName).initializeUnorderedBulkOp();
    while (batch < residual) {
        bulk.insert(genDoc());
        ++batch
    }
    result = bulk.execute({ w: 1 });
    print('Processing remainder batch,', result.nInserted, 'documents inserted');
}

print('Building indexes');

// create indexes
indexes.forEach((index) => {
    printjson(index);
    db.getSiblingDB(dbName).getCollection(collName).createIndex(index);
})

print('Complete');

// EOF