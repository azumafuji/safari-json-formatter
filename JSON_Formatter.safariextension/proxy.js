/**
 * @author Pavel Rybin
 */
(function (window) {
	var safariNameSpace = window.safari;
	var extensionSettings = safariNameSpace.extension.settings;
	var baseURI = safariNameSpace.extension.baseURI;
	var xmlHttp = new XMLHttpRequest();
	var optNames = [
		'fold_strings',
		'long_string_length',
		'unescape_unicode',
		'sort_keys',
		'font_css'
	];
	var toolbarHTML, stylesText;

	// Load css syncronically
	xmlHttp.open('GET', 'json_viewer.css', false);
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
				settings: getActualSettings()
			});
		}
	}, false);

	/**
	 * Returns actual settings
	 * @returns {object}
	 */
	function getActualSettings () {
		var settings = {};
		var curName;
		for (var i = 0, len = optNames.length; i < len; i++) {
			curName = optNames[i];
			settings[curName] = extensionSettings.getItem(curName);
		}
		return settings;
	}
})(window);
