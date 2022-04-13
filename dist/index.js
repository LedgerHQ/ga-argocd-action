/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 806:
/***/ ((module) => {

module.exports = eval("require")("@actions/core");


/***/ }),

/***/ 695:
/***/ ((module) => {

module.exports = eval("require")("node-fetch");


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
const { getInput, info, setFailed, setOutput, getBooleanInput, debug, group } = __nccwpck_require__(806)
const fetch = __nccwpck_require__(695)

const getInputs = () => {
	try {
		const action = getInput("actionName", { required: true })
		const token = getInput("argocdToken", { required: true })
		const endpoint = getInput("argocdEndpoint", { required: true })
		const applicationName = getInput("applicationName", { required: true })

		//Helm values
		const helmRepoUrl = getInput("helmRepoUrl")
		const helmChartVersion = getInput("helmChartVersion")
		const helmChartName = getInput("helmChartName")

		//Application relatives values
		const applicationNamespace = getInput("applicationNamespace") || "default"
		const applicationProject = getInput("applicationProject")
		const applicationParams = getInput("applicationParams")
		const applicationHelmValues = getInput("applicationHelmValues")

		// Others
		const maxRetry = getInput("maxRetry") || "60"
		const tts = getInput("tts") || "10"
		const destClusterName = getInput("destClusterName") || "in-cluster"
		const destClusterServer = getInput("destClusterServer") || "https://kubernetes.default.svc"
		const doSync = getBooleanInput("doSync") || true
		const onlySync = getBooleanInput("onlySync")

		if (
			(action == "create" || action == "update") &&
			( helmChartName == ""
				|| helmChartVersion == ""
				|| helmRepoUrl == "")
		) {
			throw new Error(`You must also provide ( helmChartName, helmChartVersion, helmRepoUrl) inputs when using ${action} action`)
		}

		return {
			token,
			endpoint,
			destClusterName,
			destClusterServer,
			applicationName,
			applicationNamespace,
			applicationProject,
			applicationParams,
			applicationHelmValues,
			helmChartName,
			helmChartVersion,
			helmRepoUrl,
			doSync,
			onlySync,
			maxRetry,
			tts,
			action,
		}
	} catch (error) {
		setFailed(error.message)
	}
}

const generateOpts = (method = "", bearerToken = "", bodyObj) => {
	if (method == "delete" || method == "get") {
		return { method, headers: { "Authorization": `Bearer ${bearerToken}` } }
	} else if (bodyObj == null) {
		return { method, headers: { "Content-Type": "application/json", "Authorization": `Bearer ${bearerToken}` } }
	}
	return { method, body: JSON.stringify(bodyObj), headers: { "Content-Type": "application/json", "Authorization": `Bearer ${bearerToken}` }, }
}

const checkReady = (inputs = getInputs(), retry = inputs.maxRetry) => {
	return fetch.default(`${inputs.endpoint}/api/v1/applications/${inputs.applicationName}`, generateOpts("get", inputs.token, null))
		.then(checkResponse)
		.then(r => r.json())
		.then(jsonResponse => {
			const status = jsonResponse.status.health.status
			info(`Application ${inputs.applicationName} has status ${status} (Left retries ${retry})`)
			if (status != "Healthy" && retry > 0) {
				setTimeout(() => {checkReady(inputs, retry - 1)}, inputs.tts * 1000)
			} else if (status != "Healthy" && retry == 0) {
				throw new Error(`[SYNC] ${inputs.applicationName} was unable to be fully synced after ${inputs.maxRetry} retries. Take a look at ${inputs.endpoint}/applications/${inputs.applicationName}`)
			}
		})
		.catch(err => setFailed(err))
}

const checkResponse = (response) => {
	info(`Response from ${response.url} [${response.status}] ${response.statusText}`)
	if (response.status >= 200 && response.status < 300) {
		return response;
	}
	throw new Error(`${response.url} ${response.statusText}`);
}

const checkSyncResponse = (response) => {
	info(`Response from ${response.url} [${response.status}] ${response.statusText}`)

	if ((response.status >= 200 && response.status < 300 )|| response.status == 400) {
		return response;
	}
	throw new Error(`${response.url} ${response.statusText}`);
}

const syncApplication = (inputs = getInputs()) => {
	return fetch.default(`${inputs.endpoint}/api/v1/applications/${inputs.applicationName}/sync`, generateOpts("post", inputs.token, null))
		.then(checkSyncResponse)
		.then(() => checkReady(inputs))
		.catch(err => setFailed(err.message))
}

const createApplication = (inputs = getInputs()) => {
	specs = generateSpecs(inputs)
	info(`[CREATE] Sending request to ${inputs.endpoint}/api/v1/applications`)
	return fetch.default(`${inputs.endpoint}/api/v1/applications`, generateOpts("post", inputs.token, specs))
		.then(checkResponse)
		.then(r => r.json())
		.then(jsonObj => setOutput("application", JSON.stringify(jsonObj)))
		.catch(err => setFailed(err))
}

const readApplication = (inputs = getInputs()) => {
	info(`[READ] Sending request to ${inputs.endpoint}/api/v1/applications/${inputs.applicationName}`)
	return fetch.default(`${inputs.endpoint}/api/v1/applications/${inputs.applicationName}`, generateOpts("get", inputs.token, null))
		.then(checkResponse)
		.then(r => r.json())
		.then(jsonObj => setOutput("application", JSON.stringify(jsonObj)))
		.catch(err => setFailed(err))
}

const updateApplication = (inputs = getInputs()) => {
	info(`[UPDATE] Sending request to ${inputs.endpoint}/api/v1/applications/${inputs.applicationName}`)
	specs = generateSpecs(inputs)
	return fetch.default(`${inputs.endpoint}/api/v1/applications/${inputs.applicationName}`, generateOpts("put", inputs.token, specs))
		.then(checkResponse)
		.catch(err => setFailed(err))
}

const deleteApplication = (inputs = getInputs()) => {
	info(`[DELETE] Sending request to ${inputs.endpoint}/api/v1/applications/${inputs.applicationName}`)
	return fetch.default(`${inputs.endpoint}/api/v1/applications/${inputs.applicationName}`, generateOpts("delete", inputs.token, null))
		.then(checkResponse)
		.then(() => setOutput("application", JSON.stringify({ deleted: true })))
		.catch(err => setFailed(err))
}

const parseApplicationParams = (appParams = "") => {
	return appParams.split(";").map((v) => {
		const [name, value] = v.split("=", 2)
		return { name, value }
	})
}

const generateSpecs = (inputs = getInputs()) => {
	helmParameters = parseApplicationParams(inputs.applicationParams)
	return {
		metadata: {
			name: inputs.applicationName,
			namespace: "argocd",
			finalizers: [ "resources-finalizer.argocd.argoproj.io" ]
		},
		spec: {
			source: {
				repoURL: inputs.helmRepoUrl,
				targetRevision: inputs.helmChartVersion,
				helm: {
					valueFiles: inputs.applicationHelmValues.split(";"),
					parameters: helmParameters
				},
				chart: inputs.helmChartName
			},
			destination: {
				server: inputs.destClusterServer, namespace: inputs.applicationNamespace
			},
			project: inputs.applicationProject,
			syncPolicy: {
				automated: {
					prune: true
				},
				syncOptions: [
					"PruneLast=true",
					"CreateNamespace=true"
				  ]
			}
		}
	}
}

const main = () => {
	inputs = getInputs()
	prom = null
	if (inputs.onlySync) {
		return syncApplication(inputs)
	}

	switch (inputs.action) {
		case "delete":
			return deleteApplication(inputs)
		case "get":
		case "read":
			return readApplication(inputs)
		case "create":
			prom = createApplication(inputs)
			break
		case "update":
			prom = updateApplication(inputs)
			break
		default:
			setFailed(new Error(`${inputs.action} does not exists in (create, get|read, update, delete)`))
			return
	}
	if (prom != null) {
		return prom.then(() => inputs.doSync ? syncApplication(inputs) : prom)
	}
}

main()

})();

module.exports = __webpack_exports__;
/******/ })()
;