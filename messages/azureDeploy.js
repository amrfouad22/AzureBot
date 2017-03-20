var fs = require('fs');
var path = require('path');
var util = require('util');
var async = require('async');
var expandTilde = require('expand-tilde');
var msRestAzure = require('ms-rest-azure');
var ResourceManagementClient = require('azure-arm-resource').ResourceManagementClient;
var constants = require('./constants');
const exec = require('child_process').exec;

var resourceClient;
var randomIds = {};
var location = 'eastus';
var done = false;

module.exports = {
    deployTemplate: function (username, password, dnsLabelPrefix,address, callback) {
        msRestAzure.loginWithServicePrincipalSecret(constants.clientId, constants.secret, constants.domain, function (err, credentials) {
            if (err) return console.log(err);
            resourceClient = new ResourceManagementClient(credentials, constants.subscriptionId);
            //Create resource Group
            createResourceGroup(function (err, result, request, response) {
                if (err) {
                    return callback(err, null);
                }
                else {
                    //deploy the template 
                    done = false;
                    loadTemplateAndDeploy(username, password, dnsLabelPrefix, function (err, result, request, response) {
                        if (err) {
                            callback(err, null);
                        }
                        else {
                            done = true;
                            console.log(util.format('\nDeployed template %s : \n%s', constants.deploymentName, util.inspect(result, { depth: null })));
                            callback(null, result);
                        }
                    });
                    async.whilst(function () { return !done; }, function (cb) {
                        setTimeout(function () {
                            resourceClient.deployments.get(constants.resourceGroupName, constants.deploymentName, function (err, result, request, response) {
                                if (err) {
                                    console.log(err);
                                }
                                else {
                                    sendMessage('Your Deployment state is currently:' + result.properties.provisioningState,address);
                                    if (result.properties.provisioningState == 'Succeeded'||result.properties.provisioningState == 'Failed') {
                                        done = true;
                                    }
                                    cb();
                                }
                            })
                        }, 60000);
                    })
                }
            });
        });
    }
}
// Helper functions
function createResourceGroup(callback) {
    var groupParameters = { location: location, tags: { sampletag: 'sampleValue' } };
    console.log('\nCreating resource group: ' + constants.resourceGroupName);
    return resourceClient.resourceGroups.createOrUpdate(constants.resourceGroupName, groupParameters, callback);
}

function loadTemplateAndDeploy(username, password, dnsLabelPrefix, callback) {
    try {
        var templateFilePath = path.join(__dirname, "templates/template.json");
        var template = JSON.parse(fs.readFileSync(templateFilePath, 'utf8'));
    } catch (ex) {
        return callback(ex);
    }
    console.log('\nLoaded template from template.json');
    var parameters = {
        properties: {
            template: template,
            parameters: {
                "adminUsername": {
                    "value": username
                },
                "adminPassword": {
                    "value": password
                },
                "dnsLabelPrefix": {
                    "value": dnsLabelPrefix
                }
            },
            mode: "Incremental"
        }
    };
    return resourceClient.deployments.createOrUpdate(constants.resourceGroupName,
        constants.deploymentName,
        parameters,
        callback);
}

function sendMessage(message,address) {
    var request = require('request');
    request(
        {
            url: constants.notificationUrl,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: {
                message: message,
                address: address
            },
            json: true
        }, function (err, response, body) {
            if (err) {
                console.log(err);
            }
            else {
                console.log(body);
            }
        });
}