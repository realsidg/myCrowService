"use strict";
import { Context, Service, ServiceBroker, ServiceSchema } from "moleculer";
import axios from "axios";
const axiosRetry = require('axios-retry');
import DbConnection from "../mixins/db.mixin";

axiosRetry(axios, {
	retries: 5,
	shouldResetTimeout: true,
	retryCondition: () => true // retry no matter what
});

export default class WebhookService extends Service {

	private DbMixin = new DbConnection("webhooks").start();

	// @ts-ignore
	public constructor(public broker: ServiceBroker, schema: ServiceSchema<{}> = {}) {
		super(broker);
		this.parseServiceSchema(Service.mergeSchemas({
			name: "webhooks",
			mixins: [this.DbMixin],
			settings: {
				// Available fields in the responses
				fields: [
					"_id",
					"targetUrl"
				],

				// Validator for the `create` & `insert` actions.
				entityValidator: {
					targetUrl: "url",
				},
			},
			hooks: {
				before: {},
			},
			actions: {
				/**
				 * The "moleculer-db" mixin registers the following actions:
				 *  - list
				 *  - find
				 *  - count
				 *  - create
				 *  - insert
				 *  - update
				 *  - remove
				 */

				// --- ADDITIONAL ACTIONS ---

				/**
				 * Decrease the quantity of the product item.
				 */
				trigger: {
					rest: "POST /ip",
					/** @param {Context} ctx  */
					async handler(ctx: Context<{ ipAddress: string }>) {

						var failedRequests: Object[] = [];
						var sucessfullRequests: Object[] = [];


						const docs: any[] = await this.adapter.find(
							{}
						);

						var i, j, chunked_urls, chunk_size = 10;
						for (i = 0, j = docs.length; i < j; i += chunk_size) {
							chunked_urls = docs.slice(i, i + chunk_size);
							var promises = chunked_urls.map((url) =>
								axios.post(url['targetUrl'], {
									ipAddress: ctx.params.ipAddress,
									timestamp: Date.now()
								})
							)
							await Promise.allSettled(promises).then((responses) => {
								for(const response of responses){
									if(response.status==='fulfilled'){
											sucessfullRequests.push({targetUrl:response.value.config.url,
														response:response.value.status});
									}
									else{
										failedRequests.push({targetUrl:response.reason.config.url,
													response:response.reason.response.status});
									}
								}
							})
						}


						return { sucessfullRequests, failedRequests };
					},
				},
			},
			methods: {
				/**
				 * Loading sample data to the collection.
				 * It is called in the DB.mixin after the database
				 * connection establishing & the collection is empty.
				 */
				async seedDB() {
					await this.adapter.insertMany([
						{ targetUrl: "https://facebook.com" },
						{ targetUrl: "https://google.com" },
						{ targetUrl: "https://gmail.com" },
					]);
				},
			},
			/**
			 * Loading sample data to the collection.
			async afterConnected() {
			 await this.adapter.collection.createIndex({ name: 1 });
			},
			 */
		}, schema));
	}
}
