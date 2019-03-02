/**
 * @fileoverview Class for utilizing the InContact workitem API
 * @author Joey Whelan <joey.whelan@gmail.com>
 */

/*jshint esversion: 6 */

'use strict';
'use esversion 6';
const fetch = require('node-fetch');
const btoa = require('btoa');

module.exports = class WorkItem {
	
	/** 
	 * @param {string} app InContact app name for API access
	 * @param {string} vendor InContact vendor name for API access
	 * @param {string} bu InContact business unit
	 * @param {string} poc InContact point of contact id
	 */
	constructor(app, vendor, key, poc) {
		this.key = btoa(app + '@' + vendor + ':' + key);
		this.poc = poc;
	}
	
	/**
	 * Uses a base64-encoded key to make an request for an API token.  Will propagate exceptions.
	 * @return {Promise} Promise object representing the result of fetching an API token
	 */
	getToken() {
		console.log('getToken()');
		const url = 'https://api.incontact.com/InContactAuthorizationServer/Token';
		const body = {'grant_type' : 'client_credentials'};
		
		return fetch(url, {
			method: 'POST',
			body: JSON.stringify(body),
			headers: {
				'Content-Type' : 'application/json', 
				'Authorization' : 'basic ' + this.key
			},
			cache: 'no-store',
		    mode: 'cors'
		})
		.then(response => {
			
			if (response.ok) {
				return response.json();
			}
			else {
				const msg = 'response status: ' + response.status;
				throw new Error(msg);
			}	
		})
		.then(json => {
			if (json && json.access_token && json.resource_server_base_uri) {
				return json;
			}
			else {
				const msg = 'missing token and/or uri';
				throw new Error(msg);
			}
		})
		.catch(err => {
			console.error('getToken() - ' + err.message);
			throw err;
		});
	}
	
	/**
	 * Performs a HTTP POST to the Incontact WorkItem API
	 * @param {string} workItemURL base URL for the workItem API
	 * @param {string} token InContact API token
	 * @param {string} id id for the workItem - equates to Gmail message ID for this exercise
	 * @param {string} from address of the email sender
	 * @param {string} payload body of email 
	 * @param {string} type workItem type, hard coded to 'email' here
	 * @return {Promise} Promise object representing result of the API call, in this case - a contactId.
	 */
	postWorkItem(workItemURL, token, id, from, payload, type) {
		console.log('postWorkItem() - url: ' + workItemURL + ' from: ' + from);
		const body = {
				'pointOfContact': this.poc,
				'workItemId': id,
				'workItemPayload': payload,
				'workItemType': type,
				'from': from
		};
	
		return fetch(workItemURL, {
			method: 'POST',
			body: JSON.stringify(body),
			headers: {
				'Content-Type' : 'application/json', 
				'Authorization' : 'bearer ' + token
			},
			cache: 'no-store',
			mode: 'cors'
		})
		.then(response => {
			if (response.ok) {
				return response.json();
			}
			else {
				const msg = 'response status: ' + response.status;
				throw new Error(msg);
			}
		})
		.then(json => {
				return json.contactId;
		})
		.catch(err => {
			console.error('postWorkItem() - ' + err.message);
			throw err;
		});
	}
	
	
	/**
	 * Main function.  Fetches an Incontact API token and then calls the WorkItem API
	 * @param {string} id id for the workItem - equates to Gmail message ID for this exercise
	 * @param {string} from address of the email sender
	 * @param {string} payload body of email 
	 * @return {Promise} Promise object representing result of the API call, in this case - a contactId.
	 */
	sendEmail(id, from, payload) {
		console.log('sendEmail() - id: ' + id + ' from: ' + from);
		const version = 'v13.0';
		let token, workItemURL;
		const type = 'email';
		
		return this.getToken()
		.then(data => {   
			token = data.access_token;
			workItemURL = `${data.resource_server_base_uri}services/${version}/interactions/work-items`;
			return this.postWorkItem(workItemURL, token, id, from, payload, type);
		})
		.then(contactId => { 
			return contactId;
		})
		.catch(err => {
			console.error('sendEmail() - ' + err.message);
			throw err;
		});
	}
};
