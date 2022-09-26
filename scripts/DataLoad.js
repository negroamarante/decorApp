/* 
*
  Script for loading real-esque Data in Scratch Org.
*
*/
const exec = require("child_process").exec;
const csv = require("csvtojson");
var jsforce = require("jsforce");

let RecordsInserted = new Object();
let mapRecordTypeIdByName = new Object();
let conn = {};

function execute(command, callback) {
  exec(command, function (error, stdout, stderr) {
    callback(stdout);
  });
}

// Start
console.log(
  "\n" + new Date().toLocaleTimeString() + " --- Starting DataLoad ---"
);
// Prepare objects that will work on
RecordsInserted["Tela__c"] = new Map();
RecordsInserted["Mecanismo__c"] = new Map();

init();

function init() {
  console.log("--- Get user details to start processing records. ");
  execute("sfdx force:org:display --json", (stdout, stderr) => {
    let display = JSON.parse(stdout);
    const accessToken = display.result.accessToken;
    const instanceUrl = display.result.instanceUrl;
    conn = new jsforce.Connection({
      serverUrl: instanceUrl,
      sessionId: accessToken
    });

    console.log(
      "--- Will query RecordTypes and delete records, might take some time... "
    );
    deleteRecords();
    // getRecordTypes(conn).then((response) => {
    // });
  });
}

function deleteRecords() {
  var deleteTelas = deleteExistingRecordsBulk(conn, "Tela__c");
  var deleteMecanismos = deleteExistingRecordsBulk(conn, "Mecanismo__c");

  Promise.all([deleteTelas, deleteMecanismos]).then((response) => {
    loadFirstLevelObjects();
  });
}

function loadFirstLevelObjects() {
  console.log(new Date().toLocaleTimeString() + " --- Insert Records ---");

  var telas = processCSVFileWithLookups(
    "./scripts/Telas-Rollers-08-2022.csv",
    "Tela__c",
    conn,
    [],
    []
  );
  var mecanismos = processCSVFileWithLookups(
    "./scripts/Mecanismos-Rollers-08-2022.csv",
    "Mecanismo__c",
    conn,
    [],
    []
  );

  Promise.all([telas, mecanismos]).then((response) => {
    console.log(
      "\n" +
        new Date().toLocaleTimeString() +
        " --- Base Data loaded, proceed to second level Data ---"
    );
    // loadSecondLevelObjects();
  });
}

function loadSecondLevelObjects() {
  console.log("\n" + new Date().toLocaleTimeString() + " Insert Listings ---");
  var listingInsert = processCSVFileWithLookups(
    "./listings.csv",
    "Listing__c",
    conn,
    ["Publisher__c"],
    ["Publisher__c"]
  );

  listingInsert.then((response) => {
    console.log(
      "\n" + new Date().toLocaleTimeString() + " Insert SubscriptionPlans ---"
    );

    var plansInsert = processCSVFileWithLookups(
      "./SubscriptionPlans.csv",
      "SubscriptionPlan__c",
      conn,
      ["Listing__c"],
      ["Listing__c"]
    );

    Promise.all([plansInsert]).then((response) => {
      console.log(
        "\n" + new Date().toLocaleTimeString() + " Finish Inserting ---"
      );
    });
  });
}

/*
 * HELPER METHODS
 */
function processCSVFileWithLookups(
  csvFilePath,
  sObjectType,
  conn,
  fieldsToMatch,
  fieldTypes
) {
  return new Promise((resolve, reject) => {
    var mapFieldsType = new Map();
    csv()
      .fromFile(csvFilePath)
      .then((jsonObj) => {
        // Prepare the records to insert, replace linked data
        conn.sobject(sObjectType).describe(function (err, meta) {
          if (err) {
            return console.error(err);
          }

          meta.fields.forEach(function (field) {
            mapFieldsType.set(field.name.toLocaleLowerCase(), field.type);
          });

          // prepare records to be inserted
          jsonObj.forEach(function (item) {
            if (item.recordtypeId) {
              item.recordtypeId =
                mapRecordTypeIdByName[sObjectType][item.recordtypeId];
            }

            for (var key in item) {
              if (mapFieldsType.get(key.toLocaleLowerCase()) == "boolean") {
                if (item[key] == "1") {
                  item[key] = "true";
                } else if (item[key] == "0") {
                  item[key] = "false";
                }
              } else if (mapFieldsType.get(key.toLocaleLowerCase()) == "date") {
                item[key] = new Date(item[key]);
              }
              for (i = 0; i < fieldsToMatch.length; i++) {
                if (key == fieldsToMatch[i]) {
                  if (RecordsInserted[fieldTypes[i]][item[key]]) {
                    item[key] = RecordsInserted[fieldTypes[i]][item[key]];
                  }
                }
              }
            }
          });

          // Insert the records
          conn
            .sobject(sObjectType)
            .create(jsonObj, { allowRecursive: true }, function (err, rets) {
              if (err) {
                return console.error(err);
              }

              var totalSuccess = 0;
              rets.forEach(function (item) {
                if (item.success) {
                  totalSuccess++;
                } else {
                  console.log("error sObjectType:" + sObjectType, item.errors);
                }
              });
              console.log(
                "--- Total " +
                  sObjectType +
                  " in file " +
                  csvFilePath +
                  ": " +
                  jsonObj.length
              );
              console.log(
                "--- Total " + sObjectType + " inserted : " + totalSuccess
              );
              for (i = 0; i < jsonObj.length; i++) {
                RecordsInserted[sObjectType][jsonObj[i].Name] = rets[i].id;
              }
              resolve("Completed " + csvFilePath);
            });
        });
      });
  });
}

function deleteExistingRecordsBulk(conn, sObjectType) {
  return new Promise((resolve, reject) => {
    conn
      .sobject(sObjectType)
      .find({ CreatedDate: jsforce.Date.TODAY })
      .destroy(
        {
          allowBulk: true, // allow using bulk API
          bulkThreshold: 200 // when the num of queried records exceeds this threshold, switch to Bulk API
        },
        function (err, rets) {
          if (err) {
            return console.error(err);
          }

          console.log(
            "--- Complete Delete " + sObjectType + " Successfully ---"
          );
          resolve("Completed");
        }
      );
  });
}

function getRecordTypes(conn) {
  return new Promise((resolve, reject) => {
    var mapRecordsByName = conn.query(
      "SELECT Id, Name, sObjectType FROM RecordType ",
      function (err, result) {
        if (err) {
          return console.error(err);
        }

        result.records.forEach(function (record) {
          if (!mapRecordTypeIdByName.hasOwnProperty(record.SobjectType)) {
            mapRecordTypeIdByName[record.SobjectType] = new Map();
          }
          mapRecordTypeIdByName[record.SobjectType][record.Name] = record.Id;
        });
        console.log("--- Query RecordType Successfully");
        resolve("Completed chunk");
      }
    );
  });
}
