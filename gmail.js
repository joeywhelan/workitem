/**
 * @fileoverview Class for fetching emails from gmail
 * @author Joey Whelan <joey.whelan@gmail.com>
 */

/*jshint esversion: 6 */

'use strict';
'use esversion 6';

const {promisify} = require('util');
const fs = require('fs');
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const readline = require('readline');
const {google} = require('googleapis');
const atob = require('atob');

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

/** @desc Class providing an object wrapper for REST calls to the Google STT and Sentiment API's. */
module.exports = class Gmail {
	
	/** 
	 * @param {string} credentialFile file path to the google api credential file
	 * @param {string} tokenFile file path to the google api token file
	 */
	constructor(credentialFile, tokenFile) {
		this.credentialFile = credentialFile;
		this.tokenFile = tokenFile;
		this.oAuth2Client = null;
	}
	
	/**
	 *  Reads google credential file, creates OAuth2 object, attempts to setCredentials on that object from token file
	 *  If that file doesn't exist, fetches a new token
	 *  Will propagate exceptions.
	 * @return {Promise} Promise object representing the authenticated OAuth2 object
	 */
	authorize() {
		console.log('authorize()');
		return readFileAsync(this.credentialFile)
		.then((cred) => {
			const credentials = JSON.parse(cred);
			const {client_secret, client_id, redirect_uris} = credentials.installed;
			this.oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
			return readFileAsync(this.tokenFile);
		})
		.then((result) => {
			this.oAuth2Client.setCredentials(JSON.parse(result));
			return;
		})
		.catch((err) => {
			if (err.code === 'ENOENT') {  //token file doesn't exist, go fetch a new token and write it to file
				return this._getNewToken(this.oAuth2Client);
			}
			else {
				console.error('authorize() - ' + err.message);
				throw err;
			}
		});
	}	
	
	/**
	 * Finds the label id of a given label name
	 * @param {string} name name of label
	 * @return {Promise} Promise object representing result of the API call, in this case - a label id.
	 */
	getLabelId(name) {
		console.log('getLabelId() - name: ' + name);
		const auth = this.oAuth2Client;
		const gmail = google.gmail({version: 'v1', auth});
		return new Promise((resolve, reject) => {
			gmail.users.labels.list({userId: 'me'}, (err, res) => {
				if (err) {
					reject(err);
				}
				resolve(res);
			});
		})
		.then((res) => {
			let label = res.data.labels.find(o => o.name === name);
			if (label) {
				return label.id;
			}
			else {
				throw new Error('label not found');
			}
		})
		.catch((err) => {
			console.error('getLabelId() - ' + err.message);
			throw err;
		});
	}
	
	/**
	 * Pulls the gmail message object for a given id
	 * @param {string} id gmail id of the message
	 * @return {Promise} Promise object representing the result of the gmail API call - custom object with id, from, and message
	 * body
	 */
	getMessage(id) {
		console.log('getMessage() - id: ' + id);
		const auth = this.oAuth2Client;
		const gmail = google.gmail({version: 'v1', auth});
		return new Promise((resolve, reject) => {
			gmail.users.messages.get({userId: 'me', 'id': id}, (err, res) => {
				if (err) {
					reject(err);
				}
				resolve(res);
			});
		})
		.then((res) => {
			const id = res.data.id;
			const arr = (res.data.payload.headers.find(o => o.name === 'From')).value
			.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
			let from;
			if (arr) {
				from = arr[0];
			}
			else {
				from = '';
			}
			let payload = '';
			if (res.data.payload.body.data) {
				payload = atob(res.data.payload.body.data);
			}
			return {id: id, from: from, payload: payload};
		})
		.catch((err) => {
			console.error('getMessage() - ' + err.message);
			throw err;
		});
	}
	
	/**
	 * Perform a pull of message ID's from the INBOX. 
	 * @return {Promise} Promise object representing the result of the gmail API call - array of message IDs.
	 * body
	 */
	getMessageList() {
		console.log('getMessageList()');
		const auth = this.oAuth2Client;
		const gmail = google.gmail({version: 'v1', auth});
		return new Promise((resolve, reject) => {
			gmail.users.messages.list({userId: 'me', labelIds: ['INBOX']}, (err, res) => {
				if (err) {
					reject(err);
				}
				resolve(res);
			});
		})
		.then((res) => {
			return res.data.messages;
		})
		.catch((err) => {
			console.error('getMessageList() - ' + err.message);
			throw err;
		});
	}
	
	/**
	 * Refactoring of published google demo code to support promises.  Interactive query.
	 * @private
	 * @return {Promise} Promise object with code obtained from OAuth handshake.
	 */
	_ask() {
		console.log('_ask()');
		const rl = readline.createInterface({input: process.stdin, output: process.stdout,});
		return new Promise((resolve, reject) => {
			rl.question('Enter the code from that page here: ', (code) => {
				rl.close();
				resolve(code);
			});
		});
	}
	
	/**
	 * Refactoring of published google demo code to support promises.  Interactive query.
	 * @private
	 * @return {Promise} Promise object with OAuth token object.
	 */
	_getNewToken() {
		console.log('_getNewToken()');
		return new Promise((resolve, reject) => {
			const authUrl = this.oAuth2Client.generateAuthUrl({access_type: 'offline', scope: SCOPES,});
			console.log('Authorize this app by visiting this url:', authUrl);
			this._ask()
			.then((code) => {
				return new Promise((resolve, reject) => {
					this.oAuth2Client.getToken(code, (err, token) => {
						if (err) {
							reject(err);
						}
						resolve(token);
					});
				});
			})
			.then((token) => {
				this.oAuth2Client.setCredentials(token);
				return writeFileAsync(this.tokenFile, JSON.stringify(token));
			})
			.then(_ => {
				resolve();
			})
			.catch((err) => {
				console.error('_getNewToken() - ' + err.message);
				reject(err);
			});
		});
	}
};
