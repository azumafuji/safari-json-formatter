(function(window) {
	var settings = {};
	var bodyElement = window.document.body;

	var formatJSON = {
		/**
		 * attempt to reformat the current document as JSON
		 *  TODO: examine the document's content-type (appears to be impossible)
		 */
		init: function() {
			// abort if framed (issue #7)
			if (window !== window.top) {
				return;
			}
			var oSelf = window.safari.self;

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

					formatJSON._elems = {};
					formatJSON
						.preparePage()
						.addStyle(data.css)
						.addToolbar(data.toolbar.trim())
						.renderRoot(jsonObject)
						.attachListeners();
				}
			}, false );

			// ask proxy.html for settings
			oSelf.tab.dispatchMessage("getData");
		},

		/**
		 * append child nodes to a parent node
		 *  _append( <ul/>, <li/> ) => <ul><li/></ul>
		 *  _append( <ul/>, [<li/>, <li/>] ) => <ul><li/><li/></ul>
		 */
		_append: function( parent, child ) {
			var elFragment = document.createDocumentFragment();

			if( this._typeof( child ) != "array" ) {
				child = [child];
			}
			for( var i = 0, ii = child.length; i < ii; i++ ) {
				elFragment.appendChild( child[i] );
			}
			parent.appendChild(elFragment);
			return parent;
		},

		/**
		 * convert an html string into one or more nodes
		 *  _html( "<div/>" ) => <div/>
		 *  _html( "<div/>", "<div/>" ) => [<div/>, <div/>]
		 */
		_html: (function () {
			var oElemsCache = {};

			return function(/* str, ... */) {
				var nodes = [];
				var fGetArray = Array.prototype.slice;
				var sSource, aNewElems, elTemp;

				for (var i = 0, ii = arguments.length; i < ii; i++) {
					sSource = arguments[i];

					if (this._typeof(sSource) == "string") {
						if (sSource in oElemsCache) {
							aNewElems = [oElemsCache[sSource].cloneNode(true)];
						} else {
							elTemp = document.createElement("div");
							elTemp.innerHTML = sSource;
							aNewElems = fGetArray.call(elTemp.childNodes);
							if (aNewElems.length == 1) {
								oElemsCache[sSource] = aNewElems[0].cloneNode(true);
							}
						}
						nodes = nodes.concat(aNewElems);
					} else {
						nodes = nodes.concat(sSource);
					}
				}
				return nodes.length == 1 ? nodes[0] : nodes;
			};
		})(),

		/**
		 * a slightly more informative "typeof"
		 *  _typeof( [] ) => "array"
		 *  _typeof( 1 ) => "number"
		 *  etc.
		 */
		_typeof: function( obj ) {
			if( obj === null ) {
				return "null";
			} else if( Object.prototype.toString.call( obj ) === "[object Array]" ) {
				return "array";
			} else {
				return typeof obj;
			}
		},

		/**
		 * delegating events
		 */
		_handleEvent: (function () {
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
		})(),

		/**
		 * Getting elems collection to toggle
		 */
		_getElemsToToggle: (function () {
			var elemsCache = {};
			var counter = 1;
			var counterAttr = 'data-children-list-id';
			var childrenSel = '.icon_disclosure';
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
		})(),

		/**
		 * inject css rules into the document
		 * addStyle( "a { color: blue; }" )
		 * @returns {formatJSON}
		 */
		addStyle: function( css ) {
			var style = document.createElement('style');
			style.innerHTML = css;
			bodyElement.appendChild( style );
			return this;
		},

		/**
		 * add the toolbar
		 * @returns {formatJSON}
		 */
		addToolbar: function( html ) {
			var toolbar = this._html( html );
			bodyElement.insertBefore( toolbar, bodyElement.firstChild );

			var toggle = toolbar.querySelector('.js-toggle-view');

			toggle.addEventListener("click", function() {
				bodyElement.classList.toggle('before');
			});
			return this;
		},

		/**
		 * handle javascript events
		 * @returns {formatJSON}
		 */
		attachListeners: function() {

			// disclosure triangles
			this._handleEvent('click', 'icon_disclosure', function (oEvent) {
				var elParent = oEvent.target.parentElement;

				if (oEvent.metaKey) {
					var classMethodName = elParent.classList.contains('closed') ? 'remove' : 'add';
					formatJSON._getElemsToToggle(elParent).forEach(function (elemToToggle) {
						elemToToggle.classList[classMethodName]('closed');
					});

				} else {
					elParent.classList.toggle('closed');
				}
			});
			return this;
		},

		/**
		 * hide the unformatted JSON text.
		 * add a wrapper for the formatted JSON.
		 * @returns {formatJSON}
		 */
		preparePage: function() {
			var elBody = bodyElement;
			var sourceText = elBody.textContent;
			var sourceCont = this._html('<section />');
			var jsonCont = sourceCont.cloneNode();

			sourceCont.innerText = sourceText;
			sourceCont.classList.add('source');
			jsonCont.classList.add('json');
			this._elems.source = sourceCont;
			this._elems.json = jsonCont;
			elBody.innerHTML = "";
			this._append(elBody, [sourceCont, jsonCont]);
			return this;
		},

		/**
		 * render an array as HTML
		 *  renderArray( [] ) => Element
		 */
		renderArray: function( a ) {
			var list = this._html( '<ol start="0" class="value"/>' );

			for( var i = 0, ii = a.length; i < ii; i++ ) {
				this._append( list, this._append( this._html( "<li/>" ), this.render( a[i] ) ) );
			}

			return this._append(
				this._html( '<div class="array collapsible"/>' ),
					this._html(
						'<span class="icon icon_disclosure"></span>',
						'<span class="decorator">[</span>',
						list.childNodes.length ? list : '',
						'<span class="decorator">]</span>', '<span class="separator">,</span>'
					)
				);
		},

		/**
		 * render an object as HTML
		 *  renderObject( {} ) => Element
		 */
		renderObject: function( obj ) {
			var keys = Object.keys(obj);
			var list = this._html( '<dl class="value"/>' );

			if( settings.sort_keys ) {
				keys = keys.sort();
			}

			for (var i = 0, ii = keys.length; i < ii; i++) {
				this._append( list, this._append( this._html( "<dt/>" ), this._html( '<span class="decorator">"</span>', document.createTextNode( keys[i] ), '<span class="decorator">"</span>', '<span class="delimiter">:</span>' ) ) );
				this._append( list, this._append( this._html( "<dd/>" ), this.render( obj[keys[i]] ) ) );
			}

			return this._append(
				this._html( '<div class="object collapsible"/>' ),
					this._html(
						'<span class="icon icon_disclosure"></span>',
						'<span class="decorator">{</span>',
						list.childNodes.length ? list : '',
						'<span class="decorator">}</span>',
						'<span class="separator">,</span>'
					)
				);
		},

		/**
		 * render a javascript object as JSON
		 * @returns {formatJSON}
		 */
		renderRoot: function(obj) {
			this._append(this._elems.json, this.render(obj));
			return this;
		},

		/**
		 * render a javascript string as JSON
		 */
		renderString: function( obj ) {
			var collapsible = obj.length > parseInt( settings.long_string_length, 10 );
			var collapsed = collapsible && settings.fold_strings;
			var class_names = ["string"];
			var elResult;

			if (collapsible) {
				class_names.push( "collapsible" );
			}
			if (collapsed) {
				class_names.push( "closed" );
			}

			elResult = this._append(
				this._html('<div/>'),
					this._html(
						collapsible ? '<span class="icon icon_disclosure"></span>' : '',
						'<span class="decorator">"</span>',
						this._append( this._html( '<span class="value"/>' ), document.createTextNode( obj ) ),
						'<span class="decorator">"</span>',
						'<span class="separator">,</span>'
					)
				);
			elResult.className = class_names.join(' ');
			return elResult;
		},

		/**
		 * render a literal value as HTML
		 *  renderValue( true ) => Element
		 */
		renderValue: function( l ) {
			var val = document.createTextNode( l );
			return this._append( this._append( this._html( '<span class="value"/>' ), val ), this._html( '<span class="separator">,</span>' ) );
		},

		/**
		 * render a javascript variable as HTML
		 *  render( foo ) => Element
		 */
		render: function(obj) {
			var jsonType = this._typeof(obj);
			var simpleTypeCont;

			switch(jsonType) {
				case "array": return this.renderArray(obj);
				case "object": return this.renderObject(obj);
				case "string": return this.renderString(obj);
				case "boolean":
				case "null":
				case "number":
					simpleTypeCont = this.renderValue(obj);
					simpleTypeCont.classList.add(jsonType);
					return simpleTypeCont;
			}
		}
	};
	
	// initialize!
	formatJSON.init();
}(window));
