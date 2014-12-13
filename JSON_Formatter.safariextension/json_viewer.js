(function(window) {

	// abort if framed (issue #7)
	if (window !== window.top) {
		return;
	}
	var oSelf = window.safari.self;
	var settings = {};
	var doc = window.document;
	var bodyElement = doc.body;
	var elemsCache = {};
	var elems = {};
	var text = doc.createTextNode.bind(doc);
	var templates = {
		node: '<div class="node" />',
		key: '<span class="node__key" />',
		text: '<span class="node__value" />',
		textContent: '<span class="text" />',
		literal: '<span class="node__value node__value_literal" />',
		quote: '<span class="node__quote">"</span>',
		colon: '<span class="node__delimiter">:</span>',
		comma: '<span class="node__separator">,</span>',
		bracket: '<span class="node__decorator" />',
		toggle: '<span class="toggle" />'
	};
	var cssClasses = {
		closed: 'closed',
		collapsible: 'collapsible',
		objectNode: 'node_object',
		stringNode: 'node_string',
		toggleString: 'toggle_string'
	};
	
	/**
	 * delegating events
	 */
	var handleEvent = (function () {
		var _handlers = {};

		/**
		 * Universal events handler
		 * @param {Event} eventObject
		 * @private
		 */
		var _eventsListener = function (eventObject) {
			var eventType = eventObject.type;
			var eventHandlers;

			if (eventType in _handlers) {
				eventHandlers = _handlers[eventType];

				for (var className in eventHandlers) {
					if (eventHandlers.hasOwnProperty(className) && eventObject.target.classList.contains(className)) {
						eventHandlers[className].forEach(function (callback) {
							callback.call(this, eventObject);
						}, this);
					}
				}
			}
		};

		return function (eventType, targetCssClass, callback) {
			var eventHandlers = _handlers[eventType];
			var handlersList;

			if (!eventHandlers) {
				_handlers[eventType] = eventHandlers = {};
				window.document.addEventListener(eventType, _eventsListener);
			}

			handlersList = eventHandlers[targetCssClass];
			if (!handlersList) {
				eventHandlers[targetCssClass] = handlersList = [];
			}
			handlersList.push(callback);
		};
	})();

	/**
	 * Getting elems collection to toggle
	 */
	var getElemsToToggle = (function () {
		var elemsCache = {};
		var counter = 1;
		var counterAttr = 'data-children-list-id';
		var childrenSel = '.toggle';
		var fGetParent = function (element) {
			return element.parentElement;
		};

		return function (parentElem) {
			var cacheKey = parentElem.getAttribute(counterAttr);
			var elemsCollection;

			if (cacheKey && cacheKey in elemsCache) {
				elemsCollection = elemsCache[cacheKey];

			} else {
				elemsCollection = Array.prototype.slice.call(parentElem.querySelectorAll(childrenSel), 0).map(fGetParent);
				parentElem.setAttribute(counterAttr, counter);
				elemsCache[counter] = elemsCollection;
				counter++;
			}
			return elemsCollection;
		};
	})();

	/**
	 * render a javascript variable as HTML
	 * render( foo ) => Element
	 * @param {*} value
	 * @param {string} [key]
	 * @returns {HTMLElement}
	 */
	var render = (function () {

		/**
		 * @param {Array} nodeElems
		 * @param {Array} brackets
		 * @returns {Array}
		 */
		var buildNode = function (nodeElems, brackets) {
			var result = [].concat(
				append(html(templates.bracket), text(brackets[0])),
				nodeElems,
				text(brackets[1])
			);
			// adding toogle button if an object isn't empty
			if (nodeElems.length) {
				result.push(html(templates.toggle));
			}
			return result;
		};

		return function (value, key) {
			var valueType = getTypeOf(value);
			var node = html(templates.node);
			var objectClassName = cssClasses.objectNode;
			var stringClassName = cssClasses.stringNode;
			var renderedValue, renderedKey;

			if (valueType === 'array') {
				node.classList.add(cssClasses.collapsible);
				renderedValue = buildNode(renderArray(value), ['[', ']']);

			} else if (valueType === 'object') {
				node.classList.add(objectClassName);
				node.classList.add(cssClasses.collapsible);
				renderedValue = buildNode(renderObject(value), ['{', '}']);

			} else if (valueType === 'string') {
				node.classList.add(stringClassName);
				renderedValue = renderString(value);
			} else {
				renderedValue = renderLiteral(value);
			}

			if (typeof key !== 'undefined') {
				renderedKey = [
					html(templates.quote),
					text(key),
					html(templates.quote),
					html(templates.colon)
				];
				renderedKey = append(html(templates.key), renderedKey);
				append(node, renderedKey);
			}
			return append(node, renderedValue);
		};
	})();
	
	/*
	 * attempt to reformat the current document as JSON
	 * TODO: examine the document's content-type (appears to be impossible)
	 */
	// receive settings from proxy.html
	oSelf.addEventListener("message", function(messageEvent) {
		if (messageEvent.name === "setData") {
			var data = messageEvent.message;
			var jsonObject;
			settings = data.settings;

			// attempt to parse the body as JSON
			try {
				var sJSON = bodyElement.textContent;
				if (settings.unescape_unicode) {
					sJSON = JSON.stringify(JSON.parse(sJSON));
				}
				jsonObject = JSON.parse(sJSON
						.split( "\\" ).join( "\\\\" ) // double-up on escape sequences
						.split( '\\\"' ).join( "\\\\\"" ) // at this point quotes have been unescaped.  re-escape them.
				);
			} catch( oError ) {
				// invalid JSON :(
				return;
			}

			preparePage();
			addStyle(data.css);
			addToolbar(data.toolbar.trim());

			// render a javascript object as JSON
			append(elems.json, render(jsonObject));
			attachListeners();
		}
	}, false );

	// ask proxy.html for settings
	oSelf.tab.dispatchMessage("getData");
	
	
	/**
	 * append child nodes to a parent node
	 *  append( <ul/>, <li/> ) => <ul><li/></ul>
	 *  append( <ul/>, [<li/>, <li/>] ) => <ul><li/><li/></ul>
	 */
	function append ( parent, child ) {
		var elFragment = doc.createDocumentFragment();

		if( getTypeOf( child ) != "array" ) {
			child = [child];
		}
		for( var i = 0, ii = child.length; i < ii; i++ ) {
			elFragment.appendChild( child[i] );
		}
		parent.appendChild(elFragment);
		return parent;
	}

	/**
	 * convert an html string into one or more nodes
	 *  html( "<div/>" ) => <div/>
	 *  html( "<div/>", "<div/>" ) => [<div/>, <div/>]
	 */
	function html (/* str, ... */) {
		var nodes = [];
		var fGetArray = Array.prototype.slice;
		var sSource, aNewElems, elTemp;

		for (var i = 0, ii = arguments.length; i < ii; i++) {
			sSource = arguments[i];

			if (getTypeOf(sSource) == "string") {
				if (sSource in elemsCache) {
					aNewElems = [elemsCache[sSource].cloneNode(true)];
				} else {
					elTemp = doc.createElement("div");
					elTemp.innerHTML = sSource;
					aNewElems = fGetArray.call(elTemp.childNodes);
					if (aNewElems.length == 1) {
						elemsCache[sSource] = aNewElems[0].cloneNode(true);
					}
				}
				nodes = nodes.concat(aNewElems);
			} else {
				nodes = nodes.concat(sSource);
			}
		}
		return nodes.length == 1 ? nodes[0] : nodes;
	}

	/**
	 * a slightly more informative "typeof"
	 * _typeof( [] ) => "array"
	 * _typeof( 1 ) => "number"
	 * etc.
	 * @returns {string}
	 */
	function getTypeOf (testedValue) {
		return testedValue === null ? 'null'
			: Array.isArray(testedValue) ? 'array'
			: typeof testedValue;
	}

	/**
	 * inject css rules into the document
	 * addStyle( "a { color: blue; }" )
	 */
	function addStyle (css) {
		var style = doc.createElement('style');
		style.innerHTML = css;
		bodyElement.appendChild(style);
	}

	/**
	 * add the toolbar
	 */
	function addToolbar (sourceHtml) {
		var toolbar = html( sourceHtml );
		bodyElement.insertBefore( toolbar, bodyElement.firstChild );

		var toggle = toolbar.querySelector('.js-toggle-view');

		toggle.addEventListener("click", function() {
			bodyElement.classList.toggle('before');
		});
	}

	/**
	 * handle javascript events
	 */
	function attachListeners () {

		// disclosure triangles
		handleEvent('click', 'toggle', function (oEvent) {
			var elParent = oEvent.target.parentElement;
			var closedClass = cssClasses.closed;

			if (oEvent.metaKey) {
				var classMethodName = elParent.classList.contains(closedClass) ? 'remove' : 'add';
				getElemsToToggle(elParent).forEach(function (elemToToggle) {
					elemToToggle.classList[classMethodName](closedClass);
				});

			} else {
				elParent.classList.toggle(closedClass);
			}
		});
	}

	/**
	 * hide the unformatted JSON text.
	 * add a wrapper for the formatted JSON.
	 */
	function preparePage () {
		var elBody = bodyElement;
		var sourceText = elBody.textContent;
		var sourceCont = html('<section />');
		var jsonCont = sourceCont.cloneNode(false);

		sourceCont.innerText = sourceText;
		sourceCont.classList.add('source');
		jsonCont.classList.add('json');
		elems.source = sourceCont;
		elems.json = jsonCont;
		elBody.innerHTML = "";
		append(elBody, [sourceCont, jsonCont]);
	}

	/**
	 * render an array as HTML
	 * @param {Array} arrayToRender
	 * @returns {Array} Array of elements
	 */
	function renderArray (arrayToRender) {
		var aResult = [];
		var commaTemplate = templates.comma;
		var isLastElem = true;
		var currentNode;

		for (var i = arrayToRender.length - 1; i >= 0; i--) {
			currentNode = render(arrayToRender[i]);
			if (!isLastElem) {
				append(currentNode, html(commaTemplate));
			} else {
				isLastElem = false;
			}
			aResult.unshift(currentNode);
		}
		return aResult;
	}

	/**
	 * render an object as HTML
	 * @param {object} objectToRender
	 * @returns {Array}
	 */
	function renderObject (objectToRender) {
		var keys = Object.keys(objectToRender);
		var aResult = [];
		var commaTemplate = templates.comma;
		var isLastElem = true;
		var currentKey, currentNode;

		if (settings.sort_keys) {
			keys = keys.sort();
		}
		for (var i = keys.length - 1; i >= 0; i--) {
			currentKey = keys[i];
			currentNode = render(objectToRender[currentKey], currentKey);
			if (!isLastElem) {
				append(currentNode, html(commaTemplate));
			} else {
				isLastElem = false;
			}
			aResult.unshift(currentNode);
		}
		return aResult;
	}

	/**
	 * render a javascript string as JSON
	 * @param {string} stringToRender
	 * @returns {HTMLElement}
	 */
	function renderString (stringToRender) {
		var stringCont = html(templates.text);
		var stringElems = [append(html(templates.textContent), text('"' + stringToRender + '"'))];
		var collapsible = stringToRender.length > parseInt( settings.long_string_length, 10 );
		var collapsed = collapsible && settings.fold_strings;
		var toggleElem;

		if (collapsible) {
			toggleElem = html(templates.toggle);
			toggleElem.classList.add(cssClasses.toggleString);
			stringCont.classList.add(cssClasses.collapsible);
			stringElems.push(toggleElem);
		}
		if (collapsed) {
			stringCont.classList.add(cssClasses.closed);
		}
		return append(stringCont, stringElems);
	}

	/**
	 * render a literal value as HTML
	 * renderLiteral( true ) => Element
	 * @param {number|boolean|null} valueToRender
	 * @returns {HTMLElement}
	 */
	function renderLiteral (valueToRender) {
		return append(html(templates.literal), text(valueToRender));
	}

}(window));
