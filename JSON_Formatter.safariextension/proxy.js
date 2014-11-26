/**
 * @author Pavel Rybin
 */
(function (window) {
	var safariNameSpace = window.safari;
	var extensionSettings = safariNameSpace.extension.settings;
	var baseURI = safariNameSpace.extension.baseURI;
	var xmlHttp = new XMLHttpRequest();
	var toolbarHTML, stylesText;

	// Load css syncronically
	xmlHttp.open('GET', 'formatted_json.css', false);
	xmlHttp.send(null);
	stylesText = xmlHttp.responseText.replace(/___extensionBaseUrl___/g, baseURI);

	safariNameSpace.application.addEventListener('message', function(messageEvent) {
		if (messageEvent.name === 'getData' && messageEvent.target.page) {
			if (!toolbarHTML) {
				toolbarHTML = document.getElementById('toolbar').innerHTML;
			}
			messageEvent.target.page.dispatchMessage('setData', {
				css: stylesText,
				toolbar: toolbarHTML,
				settings: {
					fold_strings: extensionSettings.getItem('fold_strings'),
					long_string_length: extensionSettings.getItem('long_string_length'),
					unescape_unicode: extensionSettings.getItem('unescape_unicode'),
					sort_keys: extensionSettings.getItem('sort_keys')
				}
			});
		}
	}, false);
})(window);
