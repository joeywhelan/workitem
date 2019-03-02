/**
 * @fileoverview Main driver for fetching an email from Gmail and then sending it to an agent via InContact's workitems API.
 * @author Joey Whelan <joey.whelan@gmail.com>
 */

/*jshint esversion: 6 */

'use strict';
'use esversion 6';

const Gmail = require('./gmail.js');
const WorkItem = require('./workitem.js');

const TOKEN_FILE = 'your gmail token file';
const CREDENTIAL_FILE = 'your gmail credentials file';
const INCONTACT_APP = 'your app name';
const INCONTACT_VENDOR = 'your vendor name';
const INCONTACT_KEY = 'your key';
const INCONTACT_POC = 'your poc';

const gmail = new Gmail(CREDENTIAL_FILE, TOKEN_FILE);
const workItem = new WorkItem(INCONTACT_APP, INCONTACT_VENDOR, INCONTACT_KEY, INCONTACT_POC);

function processMessage(id) {
	return gmail.getMessage(id)
	.then(msg => {
		return workItem.sendEmail(msg.id, msg.from, msg.payload);
	})
	.then(contactId => {
		return {msgId : id, contactId : contactId};
	});
}


gmail.authorize()
.then(_ => {
	return gmail.getMessageList();
})
.then((msgs) => {
	let p = [];
	msgs.forEach(msg => {
		p.push(processMessage(msg.id));
	});
	return Promise.all(p);
})
.then(results => {
	console.log(results);
})
.catch((err) => {
	console.log(err);
});



