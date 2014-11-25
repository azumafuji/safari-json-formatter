/**
 * @author Pavel Rybin
 */
(function (window) {
	var safariNameSpace = window.safari;
	var extensionSettings = safariNameSpace.extension.settings;
	var toolbarHTML, stylesText;

	window.safari.application.addEventListener('message', function(messageEvent) {
		if (messageEvent.name === 'getData' && messageEvent.target.page) {
			if (!toolbarHTML) {
				toolbarHTML = document.getElementById('toolbar').innerHTML;
				stylesText = document.head.getElementsByTagName('style')[0]
					.textContent.replace(/___extensionBaseUrl___/g, safariNameSpace.extension.baseURI);
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
