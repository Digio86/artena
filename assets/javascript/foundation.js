!function ($) {

  "use strict";

  var FOUNDATION_VERSION = '6.3.0';

  // Global Foundation object
  // This is attached to the window, or used as a module for AMD/Browserify
  var Foundation = {
    version: FOUNDATION_VERSION,

    /**
     * Stores initialized plugins.
     */
    _plugins: {},

    /**
     * Stores generated unique ids for plugin instances
     */
    _uuids: [],

    /**
     * Returns a boolean for RTL support
     */
    rtl: function () {
      return $('html').attr('dir') === 'rtl';
    },
    /**
     * Defines a Foundation plugin, adding it to the `Foundation` namespace and the list of plugins to initialize when reflowing.
     * @param {Object} plugin - The constructor of the plugin.
     */
    plugin: function (plugin, name) {
      // Object key to use when adding to global Foundation object
      // Examples: Foundation.Reveal, Foundation.OffCanvas
      var className = name || functionName(plugin);
      // Object key to use when storing the plugin, also used to create the identifying data attribute for the plugin
      // Examples: data-reveal, data-off-canvas
      var attrName = hyphenate(className);

      // Add to the Foundation object and the plugins list (for reflowing)
      this._plugins[attrName] = this[className] = plugin;
    },
    /**
     * @function
     * Populates the _uuids array with pointers to each individual plugin instance.
     * Adds the `zfPlugin` data-attribute to programmatically created plugins to allow use of $(selector).foundation(method) calls.
     * Also fires the initialization event for each plugin, consolidating repetitive code.
     * @param {Object} plugin - an instance of a plugin, usually `this` in context.
     * @param {String} name - the name of the plugin, passed as a camelCased string.
     * @fires Plugin#init
     */
    registerPlugin: function (plugin, name) {
      var pluginName = name ? hyphenate(name) : functionName(plugin.constructor).toLowerCase();
      plugin.uuid = this.GetYoDigits(6, pluginName);

      if (!plugin.$element.attr(`data-${pluginName}`)) {
        plugin.$element.attr(`data-${pluginName}`, plugin.uuid);
      }
      if (!plugin.$element.data('zfPlugin')) {
        plugin.$element.data('zfPlugin', plugin);
      }
      /**
       * Fires when the plugin has initialized.
       * @event Plugin#init
       */
      plugin.$element.trigger(`init.zf.${pluginName}`);

      this._uuids.push(plugin.uuid);

      return;
    },
    /**
     * @function
     * Removes the plugins uuid from the _uuids array.
     * Removes the zfPlugin data attribute, as well as the data-plugin-name attribute.
     * Also fires the destroyed event for the plugin, consolidating repetitive code.
     * @param {Object} plugin - an instance of a plugin, usually `this` in context.
     * @fires Plugin#destroyed
     */
    unregisterPlugin: function (plugin) {
      var pluginName = hyphenate(functionName(plugin.$element.data('zfPlugin').constructor));

      this._uuids.splice(this._uuids.indexOf(plugin.uuid), 1);
      plugin.$element.removeAttr(`data-${pluginName}`).removeData('zfPlugin')
      /**
       * Fires when the plugin has been destroyed.
       * @event Plugin#destroyed
       */
      .trigger(`destroyed.zf.${pluginName}`);
      for (var prop in plugin) {
        plugin[prop] = null; //clean up script to prep for garbage collection.
      }
      return;
    },

    /**
     * @function
     * Causes one or more active plugins to re-initialize, resetting event listeners, recalculating positions, etc.
     * @param {String} plugins - optional string of an individual plugin key, attained by calling `$(element).data('pluginName')`, or string of a plugin class i.e. `'dropdown'`
     * @default If no argument is passed, reflow all currently active plugins.
     */
    reInit: function (plugins) {
      var isJQ = plugins instanceof $;
      try {
        if (isJQ) {
          plugins.each(function () {
            $(this).data('zfPlugin')._init();
          });
        } else {
          var type = typeof plugins,
              _this = this,
              fns = {
            'object': function (plgs) {
              plgs.forEach(function (p) {
                p = hyphenate(p);
                $('[data-' + p + ']').foundation('_init');
              });
            },
            'string': function () {
              plugins = hyphenate(plugins);
              $('[data-' + plugins + ']').foundation('_init');
            },
            'undefined': function () {
              this['object'](Object.keys(_this._plugins));
            }
          };
          fns[type](plugins);
        }
      } catch (err) {
        console.error(err);
      } finally {
        return plugins;
      }
    },

    /**
     * returns a random base-36 uid with namespacing
     * @function
     * @param {Number} length - number of random base-36 digits desired. Increase for more random strings.
     * @param {String} namespace - name of plugin to be incorporated in uid, optional.
     * @default {String} '' - if no plugin name is provided, nothing is appended to the uid.
     * @returns {String} - unique id
     */
    GetYoDigits: function (length, namespace) {
      length = length || 6;
      return Math.round(Math.pow(36, length + 1) - Math.random() * Math.pow(36, length)).toString(36).slice(1) + (namespace ? `-${namespace}` : '');
    },
    /**
     * Initialize plugins on any elements within `elem` (and `elem` itself) that aren't already initialized.
     * @param {Object} elem - jQuery object containing the element to check inside. Also checks the element itself, unless it's the `document` object.
     * @param {String|Array} plugins - A list of plugins to initialize. Leave this out to initialize everything.
     */
    reflow: function (elem, plugins) {

      // If plugins is undefined, just grab everything
      if (typeof plugins === 'undefined') {
        plugins = Object.keys(this._plugins);
      }
      // If plugins is a string, convert it to an array with one item
      else if (typeof plugins === 'string') {
          plugins = [plugins];
        }

      var _this = this;

      // Iterate through each plugin
      $.each(plugins, function (i, name) {
        // Get the current plugin
        var plugin = _this._plugins[name];

        // Localize the search to all elements inside elem, as well as elem itself, unless elem === document
        var $elem = $(elem).find('[data-' + name + ']').addBack('[data-' + name + ']');

        // For each plugin found, initialize it
        $elem.each(function () {
          var $el = $(this),
              opts = {};
          // Don't double-dip on plugins
          if ($el.data('zfPlugin')) {
            console.warn("Tried to initialize " + name + " on an element that already has a Foundation plugin.");
            return;
          }

          if ($el.attr('data-options')) {
            var thing = $el.attr('data-options').split(';').forEach(function (e, i) {
              var opt = e.split(':').map(function (el) {
                return el.trim();
              });
              if (opt[0]) opts[opt[0]] = parseValue(opt[1]);
            });
          }
          try {
            $el.data('zfPlugin', new plugin($(this), opts));
          } catch (er) {
            console.error(er);
          } finally {
            return;
          }
        });
      });
    },
    getFnName: functionName,
    transitionend: function ($elem) {
      var transitions = {
        'transition': 'transitionend',
        'WebkitTransition': 'webkitTransitionEnd',
        'MozTransition': 'transitionend',
        'OTransition': 'otransitionend'
      };
      var elem = document.createElement('div'),
          end;

      for (var t in transitions) {
        if (typeof elem.style[t] !== 'undefined') {
          end = transitions[t];
        }
      }
      if (end) {
        return end;
      } else {
        end = setTimeout(function () {
          $elem.triggerHandler('transitionend', [$elem]);
        }, 1);
        return 'transitionend';
      }
    }
  };

  Foundation.util = {
    /**
     * Function for applying a debounce effect to a function call.
     * @function
     * @param {Function} func - Function to be called at end of timeout.
     * @param {Number} delay - Time in ms to delay the call of `func`.
     * @returns function
     */
    throttle: function (func, delay) {
      var timer = null;

      return function () {
        var context = this,
            args = arguments;

        if (timer === null) {
          timer = setTimeout(function () {
            func.apply(context, args);
            timer = null;
          }, delay);
        }
      };
    }
  };

  // TODO: consider not making this a jQuery function
  // TODO: need way to reflow vs. re-initialize
  /**
   * The Foundation jQuery method.
   * @param {String|Array} method - An action to perform on the current jQuery object.
   */
  var foundation = function (method) {
    var type = typeof method,
        $meta = $('meta.foundation-mq'),
        $noJS = $('.no-js');

    if (!$meta.length) {
      $('<meta class="foundation-mq">').appendTo(document.head);
    }
    if ($noJS.length) {
      $noJS.removeClass('no-js');
    }

    if (type === 'undefined') {
      //needs to initialize the Foundation object, or an individual plugin.
      Foundation.MediaQuery._init();
      Foundation.reflow(this);
    } else if (type === 'string') {
      //an individual method to invoke on a plugin or group of plugins
      var args = Array.prototype.slice.call(arguments, 1); //collect all the arguments, if necessary
      var plugClass = this.data('zfPlugin'); //determine the class of plugin

      if (plugClass !== undefined && plugClass[method] !== undefined) {
        //make sure both the class and method exist
        if (this.length === 1) {
          //if there's only one, call it directly.
          plugClass[method].apply(plugClass, args);
        } else {
          this.each(function (i, el) {
            //otherwise loop through the jQuery collection and invoke the method on each
            plugClass[method].apply($(el).data('zfPlugin'), args);
          });
        }
      } else {
        //error for no class or no method
        throw new ReferenceError("We're sorry, '" + method + "' is not an available method for " + (plugClass ? functionName(plugClass) : 'this element') + '.');
      }
    } else {
      //error for invalid argument type
      throw new TypeError(`We're sorry, ${type} is not a valid parameter. You must use a string representing the method you wish to invoke.`);
    }
    return this;
  };

  window.Foundation = Foundation;
  $.fn.foundation = foundation;

  // Polyfill for requestAnimationFrame
  (function () {
    if (!Date.now || !window.Date.now) window.Date.now = Date.now = function () {
      return new Date().getTime();
    };

    var vendors = ['webkit', 'moz'];
    for (var i = 0; i < vendors.length && !window.requestAnimationFrame; ++i) {
      var vp = vendors[i];
      window.requestAnimationFrame = window[vp + 'RequestAnimationFrame'];
      window.cancelAnimationFrame = window[vp + 'CancelAnimationFrame'] || window[vp + 'CancelRequestAnimationFrame'];
    }
    if (/iP(ad|hone|od).*OS 6/.test(window.navigator.userAgent) || !window.requestAnimationFrame || !window.cancelAnimationFrame) {
      var lastTime = 0;
      window.requestAnimationFrame = function (callback) {
        var now = Date.now();
        var nextTime = Math.max(lastTime + 16, now);
        return setTimeout(function () {
          callback(lastTime = nextTime);
        }, nextTime - now);
      };
      window.cancelAnimationFrame = clearTimeout;
    }
    /**
     * Polyfill for performance.now, required by rAF
     */
    if (!window.performance || !window.performance.now) {
      window.performance = {
        start: Date.now(),
        now: function () {
          return Date.now() - this.start;
        }
      };
    }
  })();
  if (!Function.prototype.bind) {
    Function.prototype.bind = function (oThis) {
      if (typeof this !== 'function') {
        // closest thing possible to the ECMAScript 5
        // internal IsCallable function
        throw new TypeError('Function.prototype.bind - what is trying to be bound is not callable');
      }

      var aArgs = Array.prototype.slice.call(arguments, 1),
          fToBind = this,
          fNOP = function () {},
          fBound = function () {
        return fToBind.apply(this instanceof fNOP ? this : oThis, aArgs.concat(Array.prototype.slice.call(arguments)));
      };

      if (this.prototype) {
        // native functions don't have a prototype
        fNOP.prototype = this.prototype;
      }
      fBound.prototype = new fNOP();

      return fBound;
    };
  }
  // Polyfill to get the name of a function in IE9
  function functionName(fn) {
    if (Function.prototype.name === undefined) {
      var funcNameRegex = /function\s([^(]{1,})\(/;
      var results = funcNameRegex.exec(fn.toString());
      return results && results.length > 1 ? results[1].trim() : "";
    } else if (fn.prototype === undefined) {
      return fn.constructor.name;
    } else {
      return fn.prototype.constructor.name;
    }
  }
  function parseValue(str) {
    if ('true' === str) return true;else if ('false' === str) return false;else if (!isNaN(str * 1)) return parseFloat(str);
    return str;
  }
  // Convert PascalCase to kebab-case
  // Thank you: http://stackoverflow.com/a/8955580
  function hyphenate(str) {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }
}(jQuery);
;'use strict';

!function ($) {

  Foundation.Box = {
    ImNotTouchingYou: ImNotTouchingYou,
    GetDimensions: GetDimensions,
    GetOffsets: GetOffsets
  };

  /**
   * Compares the dimensions of an element to a container and determines collision events with container.
   * @function
   * @param {jQuery} element - jQuery object to test for collisions.
   * @param {jQuery} parent - jQuery object to use as bounding container.
   * @param {Boolean} lrOnly - set to true to check left and right values only.
   * @param {Boolean} tbOnly - set to true to check top and bottom values only.
   * @default if no parent object passed, detects collisions with `window`.
   * @returns {Boolean} - true if collision free, false if a collision in any direction.
   */
  function ImNotTouchingYou(element, parent, lrOnly, tbOnly) {
    var eleDims = GetDimensions(element),
        top,
        bottom,
        left,
        right;

    if (parent) {
      var parDims = GetDimensions(parent);

      bottom = eleDims.offset.top + eleDims.height <= parDims.height + parDims.offset.top;
      top = eleDims.offset.top >= parDims.offset.top;
      left = eleDims.offset.left >= parDims.offset.left;
      right = eleDims.offset.left + eleDims.width <= parDims.width + parDims.offset.left;
    } else {
      bottom = eleDims.offset.top + eleDims.height <= eleDims.windowDims.height + eleDims.windowDims.offset.top;
      top = eleDims.offset.top >= eleDims.windowDims.offset.top;
      left = eleDims.offset.left >= eleDims.windowDims.offset.left;
      right = eleDims.offset.left + eleDims.width <= eleDims.windowDims.width;
    }

    var allDirs = [bottom, top, left, right];

    if (lrOnly) {
      return left === right === true;
    }

    if (tbOnly) {
      return top === bottom === true;
    }

    return allDirs.indexOf(false) === -1;
  };

  /**
   * Uses native methods to return an object of dimension values.
   * @function
   * @param {jQuery || HTML} element - jQuery object or DOM element for which to get the dimensions. Can be any element other that document or window.
   * @returns {Object} - nested object of integer pixel values
   * TODO - if element is window, return only those values.
   */
  function GetDimensions(elem, test) {
    elem = elem.length ? elem[0] : elem;

    if (elem === window || elem === document) {
      throw new Error("I'm sorry, Dave. I'm afraid I can't do that.");
    }

    var rect = elem.getBoundingClientRect(),
        parRect = elem.parentNode.getBoundingClientRect(),
        winRect = document.body.getBoundingClientRect(),
        winY = window.pageYOffset,
        winX = window.pageXOffset;

    return {
      width: rect.width,
      height: rect.height,
      offset: {
        top: rect.top + winY,
        left: rect.left + winX
      },
      parentDims: {
        width: parRect.width,
        height: parRect.height,
        offset: {
          top: parRect.top + winY,
          left: parRect.left + winX
        }
      },
      windowDims: {
        width: winRect.width,
        height: winRect.height,
        offset: {
          top: winY,
          left: winX
        }
      }
    };
  }

  /**
   * Returns an object of top and left integer pixel values for dynamically rendered elements,
   * such as: Tooltip, Reveal, and Dropdown
   * @function
   * @param {jQuery} element - jQuery object for the element being positioned.
   * @param {jQuery} anchor - jQuery object for the element's anchor point.
   * @param {String} position - a string relating to the desired position of the element, relative to it's anchor
   * @param {Number} vOffset - integer pixel value of desired vertical separation between anchor and element.
   * @param {Number} hOffset - integer pixel value of desired horizontal separation between anchor and element.
   * @param {Boolean} isOverflow - if a collision event is detected, sets to true to default the element to full width - any desired offset.
   * TODO alter/rewrite to work with `em` values as well/instead of pixels
   */
  function GetOffsets(element, anchor, position, vOffset, hOffset, isOverflow) {
    var $eleDims = GetDimensions(element),
        $anchorDims = anchor ? GetDimensions(anchor) : null;

    switch (position) {
      case 'top':
        return {
          left: Foundation.rtl() ? $anchorDims.offset.left - $eleDims.width + $anchorDims.width : $anchorDims.offset.left,
          top: $anchorDims.offset.top - ($eleDims.height + vOffset)
        };
        break;
      case 'left':
        return {
          left: $anchorDims.offset.left - ($eleDims.width + hOffset),
          top: $anchorDims.offset.top
        };
        break;
      case 'right':
        return {
          left: $anchorDims.offset.left + $anchorDims.width + hOffset,
          top: $anchorDims.offset.top
        };
        break;
      case 'center top':
        return {
          left: $anchorDims.offset.left + $anchorDims.width / 2 - $eleDims.width / 2,
          top: $anchorDims.offset.top - ($eleDims.height + vOffset)
        };
        break;
      case 'center bottom':
        return {
          left: isOverflow ? hOffset : $anchorDims.offset.left + $anchorDims.width / 2 - $eleDims.width / 2,
          top: $anchorDims.offset.top + $anchorDims.height + vOffset
        };
        break;
      case 'center left':
        return {
          left: $anchorDims.offset.left - ($eleDims.width + hOffset),
          top: $anchorDims.offset.top + $anchorDims.height / 2 - $eleDims.height / 2
        };
        break;
      case 'center right':
        return {
          left: $anchorDims.offset.left + $anchorDims.width + hOffset + 1,
          top: $anchorDims.offset.top + $anchorDims.height / 2 - $eleDims.height / 2
        };
        break;
      case 'center':
        return {
          left: $eleDims.windowDims.offset.left + $eleDims.windowDims.width / 2 - $eleDims.width / 2,
          top: $eleDims.windowDims.offset.top + $eleDims.windowDims.height / 2 - $eleDims.height / 2
        };
        break;
      case 'reveal':
        return {
          left: ($eleDims.windowDims.width - $eleDims.width) / 2,
          top: $eleDims.windowDims.offset.top + vOffset
        };
      case 'reveal full':
        return {
          left: $eleDims.windowDims.offset.left,
          top: $eleDims.windowDims.offset.top
        };
        break;
      case 'left bottom':
        return {
          left: $anchorDims.offset.left,
          top: $anchorDims.offset.top + $anchorDims.height + vOffset
        };
        break;
      case 'right bottom':
        return {
          left: $anchorDims.offset.left + $anchorDims.width + hOffset - $eleDims.width,
          top: $anchorDims.offset.top + $anchorDims.height + vOffset
        };
        break;
      default:
        return {
          left: Foundation.rtl() ? $anchorDims.offset.left - $eleDims.width + $anchorDims.width : $anchorDims.offset.left + hOffset,
          top: $anchorDims.offset.top + $anchorDims.height + vOffset
        };
    }
  }
}(jQuery);
;/*******************************************
 *                                         *
 * This util was created by Marius Olbertz *
 * Please thank Marius on GitHub /owlbertz *
 * or the web http://www.mariusolbertz.de/ *
 *                                         *
 ******************************************/

'use strict';

!function ($) {

  const keyCodes = {
    9: 'TAB',
    13: 'ENTER',
    27: 'ESCAPE',
    32: 'SPACE',
    37: 'ARROW_LEFT',
    38: 'ARROW_UP',
    39: 'ARROW_RIGHT',
    40: 'ARROW_DOWN'
  };

  var commands = {};

  var Keyboard = {
    keys: getKeyCodes(keyCodes),

    /**
     * Parses the (keyboard) event and returns a String that represents its key
     * Can be used like Foundation.parseKey(event) === Foundation.keys.SPACE
     * @param {Event} event - the event generated by the event handler
     * @return String key - String that represents the key pressed
     */
    parseKey(event) {
      var key = keyCodes[event.which || event.keyCode] || String.fromCharCode(event.which).toUpperCase();

      // Remove un-printable characters, e.g. for `fromCharCode` calls for CTRL only events
      key = key.replace(/\W+/, '');

      if (event.shiftKey) key = `SHIFT_${key}`;
      if (event.ctrlKey) key = `CTRL_${key}`;
      if (event.altKey) key = `ALT_${key}`;

      // Remove trailing underscore, in case only modifiers were used (e.g. only `CTRL_ALT`)
      key = key.replace(/_$/, '');

      return key;
    },

    /**
     * Handles the given (keyboard) event
     * @param {Event} event - the event generated by the event handler
     * @param {String} component - Foundation component's name, e.g. Slider or Reveal
     * @param {Objects} functions - collection of functions that are to be executed
     */
    handleKey(event, component, functions) {
      var commandList = commands[component],
          keyCode = this.parseKey(event),
          cmds,
          command,
          fn;

      if (!commandList) return console.warn('Component not defined!');

      if (typeof commandList.ltr === 'undefined') {
        // this component does not differentiate between ltr and rtl
        cmds = commandList; // use plain list
      } else {
        // merge ltr and rtl: if document is rtl, rtl overwrites ltr and vice versa
        if (Foundation.rtl()) cmds = $.extend({}, commandList.ltr, commandList.rtl);else cmds = $.extend({}, commandList.rtl, commandList.ltr);
      }
      command = cmds[keyCode];

      fn = functions[command];
      if (fn && typeof fn === 'function') {
        // execute function  if exists
        var returnValue = fn.apply();
        if (functions.handled || typeof functions.handled === 'function') {
          // execute function when event was handled
          functions.handled(returnValue);
        }
      } else {
        if (functions.unhandled || typeof functions.unhandled === 'function') {
          // execute function when event was not handled
          functions.unhandled();
        }
      }
    },

    /**
     * Finds all focusable elements within the given `$element`
     * @param {jQuery} $element - jQuery object to search within
     * @return {jQuery} $focusable - all focusable elements within `$element`
     */
    findFocusable($element) {
      if (!$element) {
        return false;
      }
      return $element.find('a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, *[tabindex], *[contenteditable]').filter(function () {
        if (!$(this).is(':visible') || $(this).attr('tabindex') < 0) {
          return false;
        } //only have visible elements and those that have a tabindex greater or equal 0
        return true;
      });
    },

    /**
     * Returns the component name name
     * @param {Object} component - Foundation component, e.g. Slider or Reveal
     * @return String componentName
     */

    register(componentName, cmds) {
      commands[componentName] = cmds;
    },

    /**
     * Traps the focus in the given element.
     * @param  {jQuery} $element  jQuery object to trap the foucs into.
     */
    trapFocus($element) {
      var $focusable = Foundation.Keyboard.findFocusable($element),
          $firstFocusable = $focusable.eq(0),
          $lastFocusable = $focusable.eq(-1);

      $element.on('keydown.zf.trapfocus', function (event) {
        if (event.target === $lastFocusable[0] && Foundation.Keyboard.parseKey(event) === 'TAB') {
          event.preventDefault();
          $firstFocusable.focus();
        } else if (event.target === $firstFocusable[0] && Foundation.Keyboard.parseKey(event) === 'SHIFT_TAB') {
          event.preventDefault();
          $lastFocusable.focus();
        }
      });
    },
    /**
     * Releases the trapped focus from the given element.
     * @param  {jQuery} $element  jQuery object to release the focus for.
     */
    releaseFocus($element) {
      $element.off('keydown.zf.trapfocus');
    }
  };

  /*
   * Constants for easier comparing.
   * Can be used like Foundation.parseKey(event) === Foundation.keys.SPACE
   */
  function getKeyCodes(kcs) {
    var k = {};
    for (var kc in kcs) k[kcs[kc]] = kcs[kc];
    return k;
  }

  Foundation.Keyboard = Keyboard;
}(jQuery);
;'use strict';

!function ($) {

  // Default set of media queries
  const defaultQueries = {
    'default': 'only screen',
    landscape: 'only screen and (orientation: landscape)',
    portrait: 'only screen and (orientation: portrait)',
    retina: 'only screen and (-webkit-min-device-pixel-ratio: 2),' + 'only screen and (min--moz-device-pixel-ratio: 2),' + 'only screen and (-o-min-device-pixel-ratio: 2/1),' + 'only screen and (min-device-pixel-ratio: 2),' + 'only screen and (min-resolution: 192dpi),' + 'only screen and (min-resolution: 2dppx)'
  };

  var MediaQuery = {
    queries: [],

    current: '',

    /**
     * Initializes the media query helper, by extracting the breakpoint list from the CSS and activating the breakpoint watcher.
     * @function
     * @private
     */
    _init() {
      var self = this;
      var extractedStyles = $('.foundation-mq').css('font-family');
      var namedQueries;

      namedQueries = parseStyleToObject(extractedStyles);

      for (var key in namedQueries) {
        if (namedQueries.hasOwnProperty(key)) {
          self.queries.push({
            name: key,
            value: `only screen and (min-width: ${namedQueries[key]})`
          });
        }
      }

      this.current = this._getCurrentSize();

      this._watcher();
    },

    /**
     * Checks if the screen is at least as wide as a breakpoint.
     * @function
     * @param {String} size - Name of the breakpoint to check.
     * @returns {Boolean} `true` if the breakpoint matches, `false` if it's smaller.
     */
    atLeast(size) {
      var query = this.get(size);

      if (query) {
        return window.matchMedia(query).matches;
      }

      return false;
    },

    /**
     * Checks if the screen matches to a breakpoint.
     * @function
     * @param {String} size - Name of the breakpoint to check, either 'small only' or 'small'. Omitting 'only' falls back to using atLeast() method.
     * @returns {Boolean} `true` if the breakpoint matches, `false` if it does not.
     */
    is(size) {
      size = size.trim().split(' ');
      if (size.length > 1 && size[1] === 'only') {
        if (size[0] === this._getCurrentSize()) return true;
      } else {
        return this.atLeast(size[0]);
      }
      return false;
    },

    /**
     * Gets the media query of a breakpoint.
     * @function
     * @param {String} size - Name of the breakpoint to get.
     * @returns {String|null} - The media query of the breakpoint, or `null` if the breakpoint doesn't exist.
     */
    get(size) {
      for (var i in this.queries) {
        if (this.queries.hasOwnProperty(i)) {
          var query = this.queries[i];
          if (size === query.name) return query.value;
        }
      }

      return null;
    },

    /**
     * Gets the current breakpoint name by testing every breakpoint and returning the last one to match (the biggest one).
     * @function
     * @private
     * @returns {String} Name of the current breakpoint.
     */
    _getCurrentSize() {
      var matched;

      for (var i = 0; i < this.queries.length; i++) {
        var query = this.queries[i];

        if (window.matchMedia(query.value).matches) {
          matched = query;
        }
      }

      if (typeof matched === 'object') {
        return matched.name;
      } else {
        return matched;
      }
    },

    /**
     * Activates the breakpoint watcher, which fires an event on the window whenever the breakpoint changes.
     * @function
     * @private
     */
    _watcher() {
      $(window).on('resize.zf.mediaquery', () => {
        var newSize = this._getCurrentSize(),
            currentSize = this.current;

        if (newSize !== currentSize) {
          // Change the current media query
          this.current = newSize;

          // Broadcast the media query change on the window
          $(window).trigger('changed.zf.mediaquery', [newSize, currentSize]);
        }
      });
    }
  };

  Foundation.MediaQuery = MediaQuery;

  // matchMedia() polyfill - Test a CSS media type/query in JS.
  // Authors & copyright (c) 2012: Scott Jehl, Paul Irish, Nicholas Zakas, David Knight. Dual MIT/BSD license
  window.matchMedia || (window.matchMedia = function () {
    'use strict';

    // For browsers that support matchMedium api such as IE 9 and webkit

    var styleMedia = window.styleMedia || window.media;

    // For those that don't support matchMedium
    if (!styleMedia) {
      var style = document.createElement('style'),
          script = document.getElementsByTagName('script')[0],
          info = null;

      style.type = 'text/css';
      style.id = 'matchmediajs-test';

      script && script.parentNode && script.parentNode.insertBefore(style, script);

      // 'style.currentStyle' is used by IE <= 8 and 'window.getComputedStyle' for all other browsers
      info = 'getComputedStyle' in window && window.getComputedStyle(style, null) || style.currentStyle;

      styleMedia = {
        matchMedium(media) {
          var text = `@media ${media}{ #matchmediajs-test { width: 1px; } }`;

          // 'style.styleSheet' is used by IE <= 8 and 'style.textContent' for all other browsers
          if (style.styleSheet) {
            style.styleSheet.cssText = text;
          } else {
            style.textContent = text;
          }

          // Test if media query is true or false
          return info.width === '1px';
        }
      };
    }

    return function (media) {
      return {
        matches: styleMedia.matchMedium(media || 'all'),
        media: media || 'all'
      };
    };
  }());

  // Thank you: https://github.com/sindresorhus/query-string
  function parseStyleToObject(str) {
    var styleObject = {};

    if (typeof str !== 'string') {
      return styleObject;
    }

    str = str.trim().slice(1, -1); // browsers re-quote string style values

    if (!str) {
      return styleObject;
    }

    styleObject = str.split('&').reduce(function (ret, param) {
      var parts = param.replace(/\+/g, ' ').split('=');
      var key = parts[0];
      var val = parts[1];
      key = decodeURIComponent(key);

      // missing `=` should be `null`:
      // http://w3.org/TR/2012/WD-url-20120524/#collect-url-parameters
      val = val === undefined ? null : decodeURIComponent(val);

      if (!ret.hasOwnProperty(key)) {
        ret[key] = val;
      } else if (Array.isArray(ret[key])) {
        ret[key].push(val);
      } else {
        ret[key] = [ret[key], val];
      }
      return ret;
    }, {});

    return styleObject;
  }

  Foundation.MediaQuery = MediaQuery;
}(jQuery);
;'use strict';

!function ($) {

  /**
   * Motion module.
   * @module foundation.motion
   */

  const initClasses = ['mui-enter', 'mui-leave'];
  const activeClasses = ['mui-enter-active', 'mui-leave-active'];

  const Motion = {
    animateIn: function (element, animation, cb) {
      animate(true, element, animation, cb);
    },

    animateOut: function (element, animation, cb) {
      animate(false, element, animation, cb);
    }
  };

  function Move(duration, elem, fn) {
    var anim,
        prog,
        start = null;
    // console.log('called');

    if (duration === 0) {
      fn.apply(elem);
      elem.trigger('finished.zf.animate', [elem]).triggerHandler('finished.zf.animate', [elem]);
      return;
    }

    function move(ts) {
      if (!start) start = ts;
      // console.log(start, ts);
      prog = ts - start;
      fn.apply(elem);

      if (prog < duration) {
        anim = window.requestAnimationFrame(move, elem);
      } else {
        window.cancelAnimationFrame(anim);
        elem.trigger('finished.zf.animate', [elem]).triggerHandler('finished.zf.animate', [elem]);
      }
    }
    anim = window.requestAnimationFrame(move);
  }

  /**
   * Animates an element in or out using a CSS transition class.
   * @function
   * @private
   * @param {Boolean} isIn - Defines if the animation is in or out.
   * @param {Object} element - jQuery or HTML object to animate.
   * @param {String} animation - CSS class to use.
   * @param {Function} cb - Callback to run when animation is finished.
   */
  function animate(isIn, element, animation, cb) {
    element = $(element).eq(0);

    if (!element.length) return;

    var initClass = isIn ? initClasses[0] : initClasses[1];
    var activeClass = isIn ? activeClasses[0] : activeClasses[1];

    // Set up the animation
    reset();

    element.addClass(animation).css('transition', 'none');

    requestAnimationFrame(() => {
      element.addClass(initClass);
      if (isIn) element.show();
    });

    // Start the animation
    requestAnimationFrame(() => {
      element[0].offsetWidth;
      element.css('transition', '').addClass(activeClass);
    });

    // Clean up the animation when it finishes
    element.one(Foundation.transitionend(element), finish);

    // Hides the element (for out animations), resets the element, and runs a callback
    function finish() {
      if (!isIn) element.hide();
      reset();
      if (cb) cb.apply(element);
    }

    // Resets transitions and removes motion-specific classes
    function reset() {
      element[0].style.transitionDuration = 0;
      element.removeClass(`${initClass} ${activeClass} ${animation}`);
    }
  }

  Foundation.Move = Move;
  Foundation.Motion = Motion;
}(jQuery);
;'use strict';

!function ($) {

  const Nest = {
    Feather(menu, type = 'zf') {
      menu.attr('role', 'menubar');

      var items = menu.find('li').attr({ 'role': 'menuitem' }),
          subMenuClass = `is-${type}-submenu`,
          subItemClass = `${subMenuClass}-item`,
          hasSubClass = `is-${type}-submenu-parent`;

      items.each(function () {
        var $item = $(this),
            $sub = $item.children('ul');

        if ($sub.length) {
          $item.addClass(hasSubClass).attr({
            'aria-haspopup': true,
            'aria-label': $item.children('a:first').text()
          });
          // Note:  Drilldowns behave differently in how they hide, and so need
          // additional attributes.  We should look if this possibly over-generalized
          // utility (Nest) is appropriate when we rework menus in 6.4
          if (type === 'drilldown') {
            $item.attr({ 'aria-expanded': false });
          }

          $sub.addClass(`submenu ${subMenuClass}`).attr({
            'data-submenu': '',
            'role': 'menu'
          });
          if (type === 'drilldown') {
            $sub.attr({ 'aria-hidden': true });
          }
        }

        if ($item.parent('[data-submenu]').length) {
          $item.addClass(`is-submenu-item ${subItemClass}`);
        }
      });

      return;
    },

    Burn(menu, type) {
      var //items = menu.find('li'),
      subMenuClass = `is-${type}-submenu`,
          subItemClass = `${subMenuClass}-item`,
          hasSubClass = `is-${type}-submenu-parent`;

      menu.find('>li, .menu, .menu > li').removeClass(`${subMenuClass} ${subItemClass} ${hasSubClass} is-submenu-item submenu is-active`).removeAttr('data-submenu').css('display', '');

      // console.log(      menu.find('.' + subMenuClass + ', .' + subItemClass + ', .has-submenu, .is-submenu-item, .submenu, [data-submenu]')
      //           .removeClass(subMenuClass + ' ' + subItemClass + ' has-submenu is-submenu-item submenu')
      //           .removeAttr('data-submenu'));
      // items.each(function(){
      //   var $item = $(this),
      //       $sub = $item.children('ul');
      //   if($item.parent('[data-submenu]').length){
      //     $item.removeClass('is-submenu-item ' + subItemClass);
      //   }
      //   if($sub.length){
      //     $item.removeClass('has-submenu');
      //     $sub.removeClass('submenu ' + subMenuClass).removeAttr('data-submenu');
      //   }
      // });
    }
  };

  Foundation.Nest = Nest;
}(jQuery);
;'use strict';

!function ($) {

  function Timer(elem, options, cb) {
    var _this = this,
        duration = options.duration,
        //options is an object for easily adding features later.
    nameSpace = Object.keys(elem.data())[0] || 'timer',
        remain = -1,
        start,
        timer;

    this.isPaused = false;

    this.restart = function () {
      remain = -1;
      clearTimeout(timer);
      this.start();
    };

    this.start = function () {
      this.isPaused = false;
      // if(!elem.data('paused')){ return false; }//maybe implement this sanity check if used for other things.
      clearTimeout(timer);
      remain = remain <= 0 ? duration : remain;
      elem.data('paused', false);
      start = Date.now();
      timer = setTimeout(function () {
        if (options.infinite) {
          _this.restart(); //rerun the timer.
        }
        if (cb && typeof cb === 'function') {
          cb();
        }
      }, remain);
      elem.trigger(`timerstart.zf.${nameSpace}`);
    };

    this.pause = function () {
      this.isPaused = true;
      //if(elem.data('paused')){ return false; }//maybe implement this sanity check if used for other things.
      clearTimeout(timer);
      elem.data('paused', true);
      var end = Date.now();
      remain = remain - (end - start);
      elem.trigger(`timerpaused.zf.${nameSpace}`);
    };
  }

  /**
   * Runs a callback function when images are fully loaded.
   * @param {Object} images - Image(s) to check if loaded.
   * @param {Func} callback - Function to execute when image is fully loaded.
   */
  function onImagesLoaded(images, callback) {
    var self = this,
        unloaded = images.length;

    if (unloaded === 0) {
      callback();
    }

    images.each(function () {
      // Check if image is loaded
      if (this.complete || this.readyState === 4 || this.readyState === 'complete') {
        singleImageLoaded();
      }
      // Force load the image
      else {
          // fix for IE. See https://css-tricks.com/snippets/jquery/fixing-load-in-ie-for-cached-images/
          var src = $(this).attr('src');
          $(this).attr('src', src + '?' + new Date().getTime());
          $(this).one('load', function () {
            singleImageLoaded();
          });
        }
    });

    function singleImageLoaded() {
      unloaded--;
      if (unloaded === 0) {
        callback();
      }
    }
  }

  Foundation.Timer = Timer;
  Foundation.onImagesLoaded = onImagesLoaded;
}(jQuery);
;//**************************************************
//**Work inspired by multiple jquery swipe plugins**
//**Done by Yohai Ararat ***************************
//**************************************************
(function ($) {

		$.spotSwipe = {
				version: '1.0.0',
				enabled: 'ontouchstart' in document.documentElement,
				preventDefault: false,
				moveThreshold: 75,
				timeThreshold: 200
		};

		var startPosX,
		    startPosY,
		    startTime,
		    elapsedTime,
		    isMoving = false;

		function onTouchEnd() {
				//  alert(this);
				this.removeEventListener('touchmove', onTouchMove);
				this.removeEventListener('touchend', onTouchEnd);
				isMoving = false;
		}

		function onTouchMove(e) {
				if ($.spotSwipe.preventDefault) {
						e.preventDefault();
				}
				if (isMoving) {
						var x = e.touches[0].pageX;
						var y = e.touches[0].pageY;
						var dx = startPosX - x;
						var dy = startPosY - y;
						var dir;
						elapsedTime = new Date().getTime() - startTime;
						if (Math.abs(dx) >= $.spotSwipe.moveThreshold && elapsedTime <= $.spotSwipe.timeThreshold) {
								dir = dx > 0 ? 'left' : 'right';
						}
						// else if(Math.abs(dy) >= $.spotSwipe.moveThreshold && elapsedTime <= $.spotSwipe.timeThreshold) {
						//   dir = dy > 0 ? 'down' : 'up';
						// }
						if (dir) {
								e.preventDefault();
								onTouchEnd.call(this);
								$(this).trigger('swipe', dir).trigger(`swipe${dir}`);
						}
				}
		}

		function onTouchStart(e) {
				if (e.touches.length == 1) {
						startPosX = e.touches[0].pageX;
						startPosY = e.touches[0].pageY;
						isMoving = true;
						startTime = new Date().getTime();
						this.addEventListener('touchmove', onTouchMove, false);
						this.addEventListener('touchend', onTouchEnd, false);
				}
		}

		function init() {
				this.addEventListener && this.addEventListener('touchstart', onTouchStart, false);
		}

		function teardown() {
				this.removeEventListener('touchstart', onTouchStart);
		}

		$.event.special.swipe = { setup: init };

		$.each(['left', 'up', 'down', 'right'], function () {
				$.event.special[`swipe${this}`] = { setup: function () {
								$(this).on('swipe', $.noop);
						} };
		});
})(jQuery);
/****************************************************
 * Method for adding psuedo drag events to elements *
 ***************************************************/
!function ($) {
		$.fn.addTouch = function () {
				this.each(function (i, el) {
						$(el).bind('touchstart touchmove touchend touchcancel', function () {
								//we pass the original event object because the jQuery event
								//object is normalized to w3c specs and does not provide the TouchList
								handleTouch(event);
						});
				});

				var handleTouch = function (event) {
						var touches = event.changedTouches,
						    first = touches[0],
						    eventTypes = {
								touchstart: 'mousedown',
								touchmove: 'mousemove',
								touchend: 'mouseup'
						},
						    type = eventTypes[event.type],
						    simulatedEvent;

						if ('MouseEvent' in window && typeof window.MouseEvent === 'function') {
								simulatedEvent = new window.MouseEvent(type, {
										'bubbles': true,
										'cancelable': true,
										'screenX': first.screenX,
										'screenY': first.screenY,
										'clientX': first.clientX,
										'clientY': first.clientY
								});
						} else {
								simulatedEvent = document.createEvent('MouseEvent');
								simulatedEvent.initMouseEvent(type, true, true, window, 1, first.screenX, first.screenY, first.clientX, first.clientY, false, false, false, false, 0 /*left*/, null);
						}
						first.target.dispatchEvent(simulatedEvent);
				};
		};
}(jQuery);

//**********************************
//**From the jQuery Mobile Library**
//**need to recreate functionality**
//**and try to improve if possible**
//**********************************

/* Removing the jQuery function ****
************************************

(function( $, window, undefined ) {

	var $document = $( document ),
		// supportTouch = $.mobile.support.touch,
		touchStartEvent = 'touchstart'//supportTouch ? "touchstart" : "mousedown",
		touchStopEvent = 'touchend'//supportTouch ? "touchend" : "mouseup",
		touchMoveEvent = 'touchmove'//supportTouch ? "touchmove" : "mousemove";

	// setup new event shortcuts
	$.each( ( "touchstart touchmove touchend " +
		"swipe swipeleft swiperight" ).split( " " ), function( i, name ) {

		$.fn[ name ] = function( fn ) {
			return fn ? this.bind( name, fn ) : this.trigger( name );
		};

		// jQuery < 1.8
		if ( $.attrFn ) {
			$.attrFn[ name ] = true;
		}
	});

	function triggerCustomEvent( obj, eventType, event, bubble ) {
		var originalType = event.type;
		event.type = eventType;
		if ( bubble ) {
			$.event.trigger( event, undefined, obj );
		} else {
			$.event.dispatch.call( obj, event );
		}
		event.type = originalType;
	}

	// also handles taphold

	// Also handles swipeleft, swiperight
	$.event.special.swipe = {

		// More than this horizontal displacement, and we will suppress scrolling.
		scrollSupressionThreshold: 30,

		// More time than this, and it isn't a swipe.
		durationThreshold: 1000,

		// Swipe horizontal displacement must be more than this.
		horizontalDistanceThreshold: window.devicePixelRatio >= 2 ? 15 : 30,

		// Swipe vertical displacement must be less than this.
		verticalDistanceThreshold: window.devicePixelRatio >= 2 ? 15 : 30,

		getLocation: function ( event ) {
			var winPageX = window.pageXOffset,
				winPageY = window.pageYOffset,
				x = event.clientX,
				y = event.clientY;

			if ( event.pageY === 0 && Math.floor( y ) > Math.floor( event.pageY ) ||
				event.pageX === 0 && Math.floor( x ) > Math.floor( event.pageX ) ) {

				// iOS4 clientX/clientY have the value that should have been
				// in pageX/pageY. While pageX/page/ have the value 0
				x = x - winPageX;
				y = y - winPageY;
			} else if ( y < ( event.pageY - winPageY) || x < ( event.pageX - winPageX ) ) {

				// Some Android browsers have totally bogus values for clientX/Y
				// when scrolling/zooming a page. Detectable since clientX/clientY
				// should never be smaller than pageX/pageY minus page scroll
				x = event.pageX - winPageX;
				y = event.pageY - winPageY;
			}

			return {
				x: x,
				y: y
			};
		},

		start: function( event ) {
			var data = event.originalEvent.touches ?
					event.originalEvent.touches[ 0 ] : event,
				location = $.event.special.swipe.getLocation( data );
			return {
						time: ( new Date() ).getTime(),
						coords: [ location.x, location.y ],
						origin: $( event.target )
					};
		},

		stop: function( event ) {
			var data = event.originalEvent.touches ?
					event.originalEvent.touches[ 0 ] : event,
				location = $.event.special.swipe.getLocation( data );
			return {
						time: ( new Date() ).getTime(),
						coords: [ location.x, location.y ]
					};
		},

		handleSwipe: function( start, stop, thisObject, origTarget ) {
			if ( stop.time - start.time < $.event.special.swipe.durationThreshold &&
				Math.abs( start.coords[ 0 ] - stop.coords[ 0 ] ) > $.event.special.swipe.horizontalDistanceThreshold &&
				Math.abs( start.coords[ 1 ] - stop.coords[ 1 ] ) < $.event.special.swipe.verticalDistanceThreshold ) {
				var direction = start.coords[0] > stop.coords[ 0 ] ? "swipeleft" : "swiperight";

				triggerCustomEvent( thisObject, "swipe", $.Event( "swipe", { target: origTarget, swipestart: start, swipestop: stop }), true );
				triggerCustomEvent( thisObject, direction,$.Event( direction, { target: origTarget, swipestart: start, swipestop: stop } ), true );
				return true;
			}
			return false;

		},

		// This serves as a flag to ensure that at most one swipe event event is
		// in work at any given time
		eventInProgress: false,

		setup: function() {
			var events,
				thisObject = this,
				$this = $( thisObject ),
				context = {};

			// Retrieve the events data for this element and add the swipe context
			events = $.data( this, "mobile-events" );
			if ( !events ) {
				events = { length: 0 };
				$.data( this, "mobile-events", events );
			}
			events.length++;
			events.swipe = context;

			context.start = function( event ) {

				// Bail if we're already working on a swipe event
				if ( $.event.special.swipe.eventInProgress ) {
					return;
				}
				$.event.special.swipe.eventInProgress = true;

				var stop,
					start = $.event.special.swipe.start( event ),
					origTarget = event.target,
					emitted = false;

				context.move = function( event ) {
					if ( !start || event.isDefaultPrevented() ) {
						return;
					}

					stop = $.event.special.swipe.stop( event );
					if ( !emitted ) {
						emitted = $.event.special.swipe.handleSwipe( start, stop, thisObject, origTarget );
						if ( emitted ) {

							// Reset the context to make way for the next swipe event
							$.event.special.swipe.eventInProgress = false;
						}
					}
					// prevent scrolling
					if ( Math.abs( start.coords[ 0 ] - stop.coords[ 0 ] ) > $.event.special.swipe.scrollSupressionThreshold ) {
						event.preventDefault();
					}
				};

				context.stop = function() {
						emitted = true;

						// Reset the context to make way for the next swipe event
						$.event.special.swipe.eventInProgress = false;
						$document.off( touchMoveEvent, context.move );
						context.move = null;
				};

				$document.on( touchMoveEvent, context.move )
					.one( touchStopEvent, context.stop );
			};
			$this.on( touchStartEvent, context.start );
		},

		teardown: function() {
			var events, context;

			events = $.data( this, "mobile-events" );
			if ( events ) {
				context = events.swipe;
				delete events.swipe;
				events.length--;
				if ( events.length === 0 ) {
					$.removeData( this, "mobile-events" );
				}
			}

			if ( context ) {
				if ( context.start ) {
					$( this ).off( touchStartEvent, context.start );
				}
				if ( context.move ) {
					$document.off( touchMoveEvent, context.move );
				}
				if ( context.stop ) {
					$document.off( touchStopEvent, context.stop );
				}
			}
		}
	};
	$.each({
		swipeleft: "swipe.left",
		swiperight: "swipe.right"
	}, function( event, sourceEvent ) {

		$.event.special[ event ] = {
			setup: function() {
				$( this ).bind( sourceEvent, $.noop );
			},
			teardown: function() {
				$( this ).unbind( sourceEvent );
			}
		};
	});
})( jQuery, this );
*/
;'use strict';

!function ($) {

  const MutationObserver = function () {
    var prefixes = ['WebKit', 'Moz', 'O', 'Ms', ''];
    for (var i = 0; i < prefixes.length; i++) {
      if (`${prefixes[i]}MutationObserver` in window) {
        return window[`${prefixes[i]}MutationObserver`];
      }
    }
    return false;
  }();

  const triggers = (el, type) => {
    el.data(type).split(' ').forEach(id => {
      $(`#${id}`)[type === 'close' ? 'trigger' : 'triggerHandler'](`${type}.zf.trigger`, [el]);
    });
  };
  // Elements with [data-open] will reveal a plugin that supports it when clicked.
  $(document).on('click.zf.trigger', '[data-open]', function () {
    triggers($(this), 'open');
  });

  // Elements with [data-close] will close a plugin that supports it when clicked.
  // If used without a value on [data-close], the event will bubble, allowing it to close a parent component.
  $(document).on('click.zf.trigger', '[data-close]', function () {
    let id = $(this).data('close');
    if (id) {
      triggers($(this), 'close');
    } else {
      $(this).trigger('close.zf.trigger');
    }
  });

  // Elements with [data-toggle] will toggle a plugin that supports it when clicked.
  $(document).on('click.zf.trigger', '[data-toggle]', function () {
    let id = $(this).data('toggle');
    if (id) {
      triggers($(this), 'toggle');
    } else {
      $(this).trigger('toggle.zf.trigger');
    }
  });

  // Elements with [data-closable] will respond to close.zf.trigger events.
  $(document).on('close.zf.trigger', '[data-closable]', function (e) {
    e.stopPropagation();
    let animation = $(this).data('closable');

    if (animation !== '') {
      Foundation.Motion.animateOut($(this), animation, function () {
        $(this).trigger('closed.zf');
      });
    } else {
      $(this).fadeOut().trigger('closed.zf');
    }
  });

  $(document).on('focus.zf.trigger blur.zf.trigger', '[data-toggle-focus]', function () {
    let id = $(this).data('toggle-focus');
    $(`#${id}`).triggerHandler('toggle.zf.trigger', [$(this)]);
  });

  /**
  * Fires once after all other scripts have loaded
  * @function
  * @private
  */
  $(window).on('load', () => {
    checkListeners();
  });

  function checkListeners() {
    eventsListener();
    resizeListener();
    scrollListener();
    mutateListener();
    closemeListener();
  }

  //******** only fires this function once on load, if there's something to watch ********
  function closemeListener(pluginName) {
    var yetiBoxes = $('[data-yeti-box]'),
        plugNames = ['dropdown', 'tooltip', 'reveal'];

    if (pluginName) {
      if (typeof pluginName === 'string') {
        plugNames.push(pluginName);
      } else if (typeof pluginName === 'object' && typeof pluginName[0] === 'string') {
        plugNames.concat(pluginName);
      } else {
        console.error('Plugin names must be strings');
      }
    }
    if (yetiBoxes.length) {
      let listeners = plugNames.map(name => {
        return `closeme.zf.${name}`;
      }).join(' ');

      $(window).off(listeners).on(listeners, function (e, pluginId) {
        let plugin = e.namespace.split('.')[0];
        let plugins = $(`[data-${plugin}]`).not(`[data-yeti-box="${pluginId}"]`);

        plugins.each(function () {
          let _this = $(this);

          _this.triggerHandler('close.zf.trigger', [_this]);
        });
      });
    }
  }

  function resizeListener(debounce) {
    let timer,
        $nodes = $('[data-resize]');
    if ($nodes.length) {
      $(window).off('resize.zf.trigger').on('resize.zf.trigger', function (e) {
        if (timer) {
          clearTimeout(timer);
        }

        timer = setTimeout(function () {

          if (!MutationObserver) {
            //fallback for IE 9
            $nodes.each(function () {
              $(this).triggerHandler('resizeme.zf.trigger');
            });
          }
          //trigger all listening elements and signal a resize event
          $nodes.attr('data-events', "resize");
        }, debounce || 10); //default time to emit resize event
      });
    }
  }

  function scrollListener(debounce) {
    let timer,
        $nodes = $('[data-scroll]');
    if ($nodes.length) {
      $(window).off('scroll.zf.trigger').on('scroll.zf.trigger', function (e) {
        if (timer) {
          clearTimeout(timer);
        }

        timer = setTimeout(function () {

          if (!MutationObserver) {
            //fallback for IE 9
            $nodes.each(function () {
              $(this).triggerHandler('scrollme.zf.trigger');
            });
          }
          //trigger all listening elements and signal a scroll event
          $nodes.attr('data-events', "scroll");
        }, debounce || 10); //default time to emit scroll event
      });
    }
  }

  function mutateListener(debounce) {
    let $nodes = $('[data-mutate]');
    if ($nodes.length && MutationObserver) {
      //trigger all listening elements and signal a mutate event
      //no IE 9 or 10
      $nodes.each(function () {
        $(this).triggerHandler('mutateme.zf.trigger');
      });
    }
  }

  function eventsListener() {
    if (!MutationObserver) {
      return false;
    }
    let nodes = document.querySelectorAll('[data-resize], [data-scroll], [data-mutate]');

    //element callback
    var listeningElementsMutation = function (mutationRecordsList) {
      var $target = $(mutationRecordsList[0].target);

      //trigger the event handler for the element depending on type
      switch (mutationRecordsList[0].type) {

        case "attributes":
          if ($target.attr("data-events") === "scroll" && mutationRecordsList[0].attributeName === "data-events") {
            $target.triggerHandler('scrollme.zf.trigger', [$target, window.pageYOffset]);
          }
          if ($target.attr("data-events") === "resize" && mutationRecordsList[0].attributeName === "data-events") {
            $target.triggerHandler('resizeme.zf.trigger', [$target]);
          }
          if (mutationRecordsList[0].attributeName === "style") {
            $target.closest("[data-mutate]").attr("data-events", "mutate");
            $target.closest("[data-mutate]").triggerHandler('mutateme.zf.trigger', [$target.closest("[data-mutate]")]);
          }
          break;

        case "childList":
          $target.closest("[data-mutate]").attr("data-events", "mutate");
          $target.closest("[data-mutate]").triggerHandler('mutateme.zf.trigger', [$target.closest("[data-mutate]")]);
          break;

        default:
          return false;
        //nothing
      }
    };

    if (nodes.length) {
      //for each element that needs to listen for resizing, scrolling, or mutation add a single observer
      for (var i = 0; i <= nodes.length - 1; i++) {
        var elementObserver = new MutationObserver(listeningElementsMutation);
        elementObserver.observe(nodes[i], { attributes: true, childList: true, characterData: false, subtree: true, attributeFilter: ["data-events", "style"] });
      }
    }
  }

  // ------------------------------------

  // [PH]
  // Foundation.CheckWatchers = checkWatchers;
  Foundation.IHearYou = checkListeners;
  // Foundation.ISeeYou = scrollListener;
  // Foundation.IFeelYou = closemeListener;
}(jQuery);

// function domMutationObserver(debounce) {
//   // !!! This is coming soon and needs more work; not active  !!! //
//   var timer,
//   nodes = document.querySelectorAll('[data-mutate]');
//   //
//   if (nodes.length) {
//     // var MutationObserver = (function () {
//     //   var prefixes = ['WebKit', 'Moz', 'O', 'Ms', ''];
//     //   for (var i=0; i < prefixes.length; i++) {
//     //     if (prefixes[i] + 'MutationObserver' in window) {
//     //       return window[prefixes[i] + 'MutationObserver'];
//     //     }
//     //   }
//     //   return false;
//     // }());
//
//
//     //for the body, we need to listen for all changes effecting the style and class attributes
//     var bodyObserver = new MutationObserver(bodyMutation);
//     bodyObserver.observe(document.body, { attributes: true, childList: true, characterData: false, subtree:true, attributeFilter:["style", "class"]});
//
//
//     //body callback
//     function bodyMutation(mutate) {
//       //trigger all listening elements and signal a mutation event
//       if (timer) { clearTimeout(timer); }
//
//       timer = setTimeout(function() {
//         bodyObserver.disconnect();
//         $('[data-mutate]').attr('data-events',"mutate");
//       }, debounce || 150);
//     }
//   }
// }
;'use strict';

!function ($) {

  /**
   * Abide module.
   * @module foundation.abide
   */

  class Abide {
    /**
     * Creates a new instance of Abide.
     * @class
     * @fires Abide#init
     * @param {Object} element - jQuery object to add the trigger to.
     * @param {Object} options - Overrides to the default plugin settings.
     */
    constructor(element, options = {}) {
      this.$element = element;
      this.options = $.extend({}, Abide.defaults, this.$element.data(), options);

      this._init();

      Foundation.registerPlugin(this, 'Abide');
    }

    /**
     * Initializes the Abide plugin and calls functions to get Abide functioning on load.
     * @private
     */
    _init() {
      this.$inputs = this.$element.find('input, textarea, select');

      this._events();
    }

    /**
     * Initializes events for Abide.
     * @private
     */
    _events() {
      this.$element.off('.abide').on('reset.zf.abide', () => {
        this.resetForm();
      }).on('submit.zf.abide', () => {
        return this.validateForm();
      });

      if (this.options.validateOn === 'fieldChange') {
        this.$inputs.off('change.zf.abide').on('change.zf.abide', e => {
          this.validateInput($(e.target));
        });
      }

      if (this.options.liveValidate) {
        this.$inputs.off('input.zf.abide').on('input.zf.abide', e => {
          this.validateInput($(e.target));
        });
      }

      if (this.options.validateOnBlur) {
        this.$inputs.off('blur.zf.abide').on('blur.zf.abide', e => {
          this.validateInput($(e.target));
        });
      }
    }

    /**
     * Calls necessary functions to update Abide upon DOM change
     * @private
     */
    _reflow() {
      this._init();
    }

    /**
     * Checks whether or not a form element has the required attribute and if it's checked or not
     * @param {Object} element - jQuery object to check for required attribute
     * @returns {Boolean} Boolean value depends on whether or not attribute is checked or empty
     */
    requiredCheck($el) {
      if (!$el.attr('required')) return true;

      var isGood = true;

      switch ($el[0].type) {
        case 'checkbox':
          isGood = $el[0].checked;
          break;

        case 'select':
        case 'select-one':
        case 'select-multiple':
          var opt = $el.find('option:selected');
          if (!opt.length || !opt.val()) isGood = false;
          break;

        default:
          if (!$el.val() || !$el.val().length) isGood = false;
      }

      return isGood;
    }

    /**
     * Based on $el, get the first element with selector in this order:
     * 1. The element's direct sibling('s).
     * 3. The element's parent's children.
     *
     * This allows for multiple form errors per input, though if none are found, no form errors will be shown.
     *
     * @param {Object} $el - jQuery object to use as reference to find the form error selector.
     * @returns {Object} jQuery object with the selector.
     */
    findFormError($el) {
      var $error = $el.siblings(this.options.formErrorSelector);

      if (!$error.length) {
        $error = $el.parent().find(this.options.formErrorSelector);
      }

      return $error;
    }

    /**
     * Get the first element in this order:
     * 2. The <label> with the attribute `[for="someInputId"]`
     * 3. The `.closest()` <label>
     *
     * @param {Object} $el - jQuery object to check for required attribute
     * @returns {Boolean} Boolean value depends on whether or not attribute is checked or empty
     */
    findLabel($el) {
      var id = $el[0].id;
      var $label = this.$element.find(`label[for="${id}"]`);

      if (!$label.length) {
        return $el.closest('label');
      }

      return $label;
    }

    /**
     * Get the set of labels associated with a set of radio els in this order
     * 2. The <label> with the attribute `[for="someInputId"]`
     * 3. The `.closest()` <label>
     *
     * @param {Object} $el - jQuery object to check for required attribute
     * @returns {Boolean} Boolean value depends on whether or not attribute is checked or empty
     */
    findRadioLabels($els) {
      var labels = $els.map((i, el) => {
        var id = el.id;
        var $label = this.$element.find(`label[for="${id}"]`);

        if (!$label.length) {
          $label = $(el).closest('label');
        }
        return $label[0];
      });

      return $(labels);
    }

    /**
     * Adds the CSS error class as specified by the Abide settings to the label, input, and the form
     * @param {Object} $el - jQuery object to add the class to
     */
    addErrorClasses($el) {
      var $label = this.findLabel($el);
      var $formError = this.findFormError($el);

      if ($label.length) {
        $label.addClass(this.options.labelErrorClass);
      }

      if ($formError.length) {
        $formError.addClass(this.options.formErrorClass);
      }

      $el.addClass(this.options.inputErrorClass).attr('data-invalid', '');
    }

    /**
     * Remove CSS error classes etc from an entire radio button group
     * @param {String} groupName - A string that specifies the name of a radio button group
     *
     */

    removeRadioErrorClasses(groupName) {
      var $els = this.$element.find(`:radio[name="${groupName}"]`);
      var $labels = this.findRadioLabels($els);
      var $formErrors = this.findFormError($els);

      if ($labels.length) {
        $labels.removeClass(this.options.labelErrorClass);
      }

      if ($formErrors.length) {
        $formErrors.removeClass(this.options.formErrorClass);
      }

      $els.removeClass(this.options.inputErrorClass).removeAttr('data-invalid');
    }

    /**
     * Removes CSS error class as specified by the Abide settings from the label, input, and the form
     * @param {Object} $el - jQuery object to remove the class from
     */
    removeErrorClasses($el) {
      // radios need to clear all of the els
      if ($el[0].type == 'radio') {
        return this.removeRadioErrorClasses($el.attr('name'));
      }

      var $label = this.findLabel($el);
      var $formError = this.findFormError($el);

      if ($label.length) {
        $label.removeClass(this.options.labelErrorClass);
      }

      if ($formError.length) {
        $formError.removeClass(this.options.formErrorClass);
      }

      $el.removeClass(this.options.inputErrorClass).removeAttr('data-invalid');
    }

    /**
     * Goes through a form to find inputs and proceeds to validate them in ways specific to their type
     * @fires Abide#invalid
     * @fires Abide#valid
     * @param {Object} element - jQuery object to validate, should be an HTML input
     * @returns {Boolean} goodToGo - If the input is valid or not.
     */
    validateInput($el) {
      var clearRequire = this.requiredCheck($el),
          validated = false,
          customValidator = true,
          validator = $el.attr('data-validator'),
          equalTo = true;

      // don't validate ignored inputs or hidden inputs
      if ($el.is('[data-abide-ignore]') || $el.is('[type="hidden"]')) {
        return true;
      }

      switch ($el[0].type) {
        case 'radio':
          validated = this.validateRadio($el.attr('name'));
          break;

        case 'checkbox':
          validated = clearRequire;
          break;

        case 'select':
        case 'select-one':
        case 'select-multiple':
          validated = clearRequire;
          break;

        default:
          validated = this.validateText($el);
      }

      if (validator) {
        customValidator = this.matchValidation($el, validator, $el.attr('required'));
      }

      if ($el.attr('data-equalto')) {
        equalTo = this.options.validators.equalTo($el);
      }

      var goodToGo = [clearRequire, validated, customValidator, equalTo].indexOf(false) === -1;
      var message = (goodToGo ? 'valid' : 'invalid') + '.zf.abide';

      if (goodToGo) {
        // Re-validate inputs that depend on this one with equalto
        const dependentElements = this.$element.find(`[data-equalto="${$el.attr('id')}"]`);
        if (dependentElements.length) {
          let _this = this;
          dependentElements.each(function () {
            if ($(this).val()) {
              _this.validateInput($(this));
            }
          });
        }
      }

      this[goodToGo ? 'removeErrorClasses' : 'addErrorClasses']($el);

      /**
       * Fires when the input is done checking for validation. Event trigger is either `valid.zf.abide` or `invalid.zf.abide`
       * Trigger includes the DOM element of the input.
       * @event Abide#valid
       * @event Abide#invalid
       */
      $el.trigger(message, [$el]);

      return goodToGo;
    }

    /**
     * Goes through a form and if there are any invalid inputs, it will display the form error element
     * @returns {Boolean} noError - true if no errors were detected...
     * @fires Abide#formvalid
     * @fires Abide#forminvalid
     */
    validateForm() {
      var acc = [];
      var _this = this;

      this.$inputs.each(function () {
        acc.push(_this.validateInput($(this)));
      });

      var noError = acc.indexOf(false) === -1;

      this.$element.find('[data-abide-error]').css('display', noError ? 'none' : 'block');

      /**
       * Fires when the form is finished validating. Event trigger is either `formvalid.zf.abide` or `forminvalid.zf.abide`.
       * Trigger includes the element of the form.
       * @event Abide#formvalid
       * @event Abide#forminvalid
       */
      this.$element.trigger((noError ? 'formvalid' : 'forminvalid') + '.zf.abide', [this.$element]);

      return noError;
    }

    /**
     * Determines whether or a not a text input is valid based on the pattern specified in the attribute. If no matching pattern is found, returns true.
     * @param {Object} $el - jQuery object to validate, should be a text input HTML element
     * @param {String} pattern - string value of one of the RegEx patterns in Abide.options.patterns
     * @returns {Boolean} Boolean value depends on whether or not the input value matches the pattern specified
     */
    validateText($el, pattern) {
      // A pattern can be passed to this function, or it will be infered from the input's "pattern" attribute, or it's "type" attribute
      pattern = pattern || $el.attr('pattern') || $el.attr('type');
      var inputText = $el.val();
      var valid = false;

      if (inputText.length) {
        // If the pattern attribute on the element is in Abide's list of patterns, then test that regexp
        if (this.options.patterns.hasOwnProperty(pattern)) {
          valid = this.options.patterns[pattern].test(inputText);
        }
        // If the pattern name isn't also the type attribute of the field, then test it as a regexp
        else if (pattern !== $el.attr('type')) {
            valid = new RegExp(pattern).test(inputText);
          } else {
            valid = true;
          }
      }
      // An empty field is valid if it's not required
      else if (!$el.prop('required')) {
          valid = true;
        }

      return valid;
    }

    /**
     * Determines whether or a not a radio input is valid based on whether or not it is required and selected. Although the function targets a single `<input>`, it validates by checking the `required` and `checked` properties of all radio buttons in its group.
     * @param {String} groupName - A string that specifies the name of a radio button group
     * @returns {Boolean} Boolean value depends on whether or not at least one radio input has been selected (if it's required)
     */
    validateRadio(groupName) {
      // If at least one radio in the group has the `required` attribute, the group is considered required
      // Per W3C spec, all radio buttons in a group should have `required`, but we're being nice
      var $group = this.$element.find(`:radio[name="${groupName}"]`);
      var valid = false,
          required = false;

      // For the group to be required, at least one radio needs to be required
      $group.each((i, e) => {
        if ($(e).attr('required')) {
          required = true;
        }
      });
      if (!required) valid = true;

      if (!valid) {
        // For the group to be valid, at least one radio needs to be checked
        $group.each((i, e) => {
          if ($(e).prop('checked')) {
            valid = true;
          }
        });
      };

      return valid;
    }

    /**
     * Determines if a selected input passes a custom validation function. Multiple validations can be used, if passed to the element with `data-validator="foo bar baz"` in a space separated listed.
     * @param {Object} $el - jQuery input element.
     * @param {String} validators - a string of function names matching functions in the Abide.options.validators object.
     * @param {Boolean} required - self explanatory?
     * @returns {Boolean} - true if validations passed.
     */
    matchValidation($el, validators, required) {
      required = required ? true : false;

      var clear = validators.split(' ').map(v => {
        return this.options.validators[v]($el, required, $el.parent());
      });
      return clear.indexOf(false) === -1;
    }

    /**
     * Resets form inputs and styles
     * @fires Abide#formreset
     */
    resetForm() {
      var $form = this.$element,
          opts = this.options;

      $(`.${opts.labelErrorClass}`, $form).not('small').removeClass(opts.labelErrorClass);
      $(`.${opts.inputErrorClass}`, $form).not('small').removeClass(opts.inputErrorClass);
      $(`${opts.formErrorSelector}.${opts.formErrorClass}`).removeClass(opts.formErrorClass);
      $form.find('[data-abide-error]').css('display', 'none');
      $(':input', $form).not(':button, :submit, :reset, :hidden, :radio, :checkbox, [data-abide-ignore]').val('').removeAttr('data-invalid');
      $(':input:radio', $form).not('[data-abide-ignore]').prop('checked', false).removeAttr('data-invalid');
      $(':input:checkbox', $form).not('[data-abide-ignore]').prop('checked', false).removeAttr('data-invalid');
      /**
       * Fires when the form has been reset.
       * @event Abide#formreset
       */
      $form.trigger('formreset.zf.abide', [$form]);
    }

    /**
     * Destroys an instance of Abide.
     * Removes error styles and classes from elements, without resetting their values.
     */
    destroy() {
      var _this = this;
      this.$element.off('.abide').find('[data-abide-error]').css('display', 'none');

      this.$inputs.off('.abide').each(function () {
        _this.removeErrorClasses($(this));
      });

      Foundation.unregisterPlugin(this);
    }
  }

  /**
   * Default settings for plugin
   */
  Abide.defaults = {
    /**
     * The default event to validate inputs. Checkboxes and radios validate immediately.
     * Remove or change this value for manual validation.
     * @option
     * @example 'fieldChange'
     */
    validateOn: 'fieldChange',

    /**
     * Class to be applied to input labels on failed validation.
     * @option
     * @example 'is-invalid-label'
     */
    labelErrorClass: 'is-invalid-label',

    /**
     * Class to be applied to inputs on failed validation.
     * @option
     * @example 'is-invalid-input'
     */
    inputErrorClass: 'is-invalid-input',

    /**
     * Class selector to use to target Form Errors for show/hide.
     * @option
     * @example '.form-error'
     */
    formErrorSelector: '.form-error',

    /**
     * Class added to Form Errors on failed validation.
     * @option
     * @example 'is-visible'
     */
    formErrorClass: 'is-visible',

    /**
     * Set to true to validate text inputs on any value change.
     * @option
     * @example false
     */
    liveValidate: false,

    /**
     * Set to true to validate inputs on blur.
     * @option
     * @example false
     */
    validateOnBlur: false,

    patterns: {
      alpha: /^[a-zA-Z]+$/,
      alpha_numeric: /^[a-zA-Z0-9]+$/,
      integer: /^[-+]?\d+$/,
      number: /^[-+]?\d*(?:[\.\,]\d+)?$/,

      // amex, visa, diners
      card: /^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|6(?:011|5[0-9][0-9])[0-9]{12}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\d{3})\d{11})$/,
      cvv: /^([0-9]){3,4}$/,

      // http://www.whatwg.org/specs/web-apps/current-work/multipage/states-of-the-type-attribute.html#valid-e-mail-address
      email: /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/,

      url: /^(https?|ftp|file|ssh):\/\/(((([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-zA-Z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-zA-Z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-zA-Z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-zA-Z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-zA-Z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-zA-Z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/,
      // abc.de
      domain: /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,8}$/,

      datetime: /^([0-2][0-9]{3})\-([0-1][0-9])\-([0-3][0-9])T([0-5][0-9])\:([0-5][0-9])\:([0-5][0-9])(Z|([\-\+]([0-1][0-9])\:00))$/,
      // YYYY-MM-DD
      date: /(?:19|20)[0-9]{2}-(?:(?:0[1-9]|1[0-2])-(?:0[1-9]|1[0-9]|2[0-9])|(?:(?!02)(?:0[1-9]|1[0-2])-(?:30))|(?:(?:0[13578]|1[02])-31))$/,
      // HH:MM:SS
      time: /^(0[0-9]|1[0-9]|2[0-3])(:[0-5][0-9]){2}$/,
      dateISO: /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/,
      // MM/DD/YYYY
      month_day_year: /^(0[1-9]|1[012])[- \/.](0[1-9]|[12][0-9]|3[01])[- \/.]\d{4}$/,
      // DD/MM/YYYY
      day_month_year: /^(0[1-9]|[12][0-9]|3[01])[- \/.](0[1-9]|1[012])[- \/.]\d{4}$/,

      // #FFF or #FFFFFF
      color: /^#?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/
    },

    /**
     * Optional validation functions to be used. `equalTo` being the only default included function.
     * Functions should return only a boolean if the input is valid or not. Functions are given the following arguments:
     * el : The jQuery element to validate.
     * required : Boolean value of the required attribute be present or not.
     * parent : The direct parent of the input.
     * @option
     */
    validators: {
      equalTo: function (el, required, parent) {
        return $(`#${el.attr('data-equalto')}`).val() === el.val();
      }
    }
  };

  // Window exports
  Foundation.plugin(Abide, 'Abide');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * Accordion module.
   * @module foundation.accordion
   * @requires foundation.util.keyboard
   * @requires foundation.util.motion
   */

  class Accordion {
    /**
     * Creates a new instance of an accordion.
     * @class
     * @fires Accordion#init
     * @param {jQuery} element - jQuery object to make into an accordion.
     * @param {Object} options - a plain object with settings to override the default options.
     */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, Accordion.defaults, this.$element.data(), options);

      this._init();

      Foundation.registerPlugin(this, 'Accordion');
      Foundation.Keyboard.register('Accordion', {
        'ENTER': 'toggle',
        'SPACE': 'toggle',
        'ARROW_DOWN': 'next',
        'ARROW_UP': 'previous'
      });
    }

    /**
     * Initializes the accordion by animating the preset active pane(s).
     * @private
     */
    _init() {
      this.$element.attr('role', 'tablist');
      this.$tabs = this.$element.children('[data-accordion-item]');

      this.$tabs.each(function (idx, el) {
        var $el = $(el),
            $content = $el.children('[data-tab-content]'),
            id = $content[0].id || Foundation.GetYoDigits(6, 'accordion'),
            linkId = el.id || `${id}-label`;

        $el.find('a:first').attr({
          'aria-controls': id,
          'role': 'tab',
          'id': linkId,
          'aria-expanded': false,
          'aria-selected': false
        });

        $content.attr({ 'role': 'tabpanel', 'aria-labelledby': linkId, 'aria-hidden': true, 'id': id });
      });
      var $initActive = this.$element.find('.is-active').children('[data-tab-content]');
      if ($initActive.length) {
        this.down($initActive, true);
      }
      this._events();
    }

    /**
     * Adds event handlers for items within the accordion.
     * @private
     */
    _events() {
      var _this = this;

      this.$tabs.each(function () {
        var $elem = $(this);
        var $tabContent = $elem.children('[data-tab-content]');
        if ($tabContent.length) {
          $elem.children('a').off('click.zf.accordion keydown.zf.accordion').on('click.zf.accordion', function (e) {
            e.preventDefault();
            _this.toggle($tabContent);
          }).on('keydown.zf.accordion', function (e) {
            Foundation.Keyboard.handleKey(e, 'Accordion', {
              toggle: function () {
                _this.toggle($tabContent);
              },
              next: function () {
                var $a = $elem.next().find('a').focus();
                if (!_this.options.multiExpand) {
                  $a.trigger('click.zf.accordion');
                }
              },
              previous: function () {
                var $a = $elem.prev().find('a').focus();
                if (!_this.options.multiExpand) {
                  $a.trigger('click.zf.accordion');
                }
              },
              handled: function () {
                e.preventDefault();
                e.stopPropagation();
              }
            });
          });
        }
      });
    }

    /**
     * Toggles the selected content pane's open/close state.
     * @param {jQuery} $target - jQuery object of the pane to toggle (`.accordion-content`).
     * @function
     */
    toggle($target) {
      if ($target.parent().hasClass('is-active')) {
        this.up($target);
      } else {
        this.down($target);
      }
    }

    /**
     * Opens the accordion tab defined by `$target`.
     * @param {jQuery} $target - Accordion pane to open (`.accordion-content`).
     * @param {Boolean} firstTime - flag to determine if reflow should happen.
     * @fires Accordion#down
     * @function
     */
    down($target, firstTime) {
      $target.attr('aria-hidden', false).parent('[data-tab-content]').addBack().parent().addClass('is-active');

      if (!this.options.multiExpand && !firstTime) {
        var $currentActive = this.$element.children('.is-active').children('[data-tab-content]');
        if ($currentActive.length) {
          this.up($currentActive.not($target));
        }
      }

      $target.slideDown(this.options.slideSpeed, () => {
        /**
         * Fires when the tab is done opening.
         * @event Accordion#down
         */
        this.$element.trigger('down.zf.accordion', [$target]);
      });

      $(`#${$target.attr('aria-labelledby')}`).attr({
        'aria-expanded': true,
        'aria-selected': true
      });
    }

    /**
     * Closes the tab defined by `$target`.
     * @param {jQuery} $target - Accordion tab to close (`.accordion-content`).
     * @fires Accordion#up
     * @function
     */
    up($target) {
      var $aunts = $target.parent().siblings(),
          _this = this;

      if (!this.options.allowAllClosed && !$aunts.hasClass('is-active') || !$target.parent().hasClass('is-active')) {
        return;
      }

      // Foundation.Move(this.options.slideSpeed, $target, function(){
      $target.slideUp(_this.options.slideSpeed, function () {
        /**
         * Fires when the tab is done collapsing up.
         * @event Accordion#up
         */
        _this.$element.trigger('up.zf.accordion', [$target]);
      });
      // });

      $target.attr('aria-hidden', true).parent().removeClass('is-active');

      $(`#${$target.attr('aria-labelledby')}`).attr({
        'aria-expanded': false,
        'aria-selected': false
      });
    }

    /**
     * Destroys an instance of an accordion.
     * @fires Accordion#destroyed
     * @function
     */
    destroy() {
      this.$element.find('[data-tab-content]').stop(true).slideUp(0).css('display', '');
      this.$element.find('a').off('.zf.accordion');

      Foundation.unregisterPlugin(this);
    }
  }

  Accordion.defaults = {
    /**
     * Amount of time to animate the opening of an accordion pane.
     * @option
     * @example 250
     */
    slideSpeed: 250,
    /**
     * Allow the accordion to have multiple open panes.
     * @option
     * @example false
     */
    multiExpand: false,
    /**
     * Allow the accordion to close all panes.
     * @option
     * @example false
     */
    allowAllClosed: false
  };

  // Window exports
  Foundation.plugin(Accordion, 'Accordion');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * AccordionMenu module.
   * @module foundation.accordionMenu
   * @requires foundation.util.keyboard
   * @requires foundation.util.motion
   * @requires foundation.util.nest
   */

  class AccordionMenu {
    /**
     * Creates a new instance of an accordion menu.
     * @class
     * @fires AccordionMenu#init
     * @param {jQuery} element - jQuery object to make into an accordion menu.
     * @param {Object} options - Overrides to the default plugin settings.
     */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, AccordionMenu.defaults, this.$element.data(), options);

      Foundation.Nest.Feather(this.$element, 'accordion');

      this._init();

      Foundation.registerPlugin(this, 'AccordionMenu');
      Foundation.Keyboard.register('AccordionMenu', {
        'ENTER': 'toggle',
        'SPACE': 'toggle',
        'ARROW_RIGHT': 'open',
        'ARROW_UP': 'up',
        'ARROW_DOWN': 'down',
        'ARROW_LEFT': 'close',
        'ESCAPE': 'closeAll'
      });
    }

    /**
     * Initializes the accordion menu by hiding all nested menus.
     * @private
     */
    _init() {
      this.$element.find('[data-submenu]').not('.is-active').slideUp(0); //.find('a').css('padding-left', '1rem');
      this.$element.attr({
        'role': 'menu',
        'aria-multiselectable': this.options.multiOpen
      });

      this.$menuLinks = this.$element.find('.is-accordion-submenu-parent');
      this.$menuLinks.each(function () {
        var linkId = this.id || Foundation.GetYoDigits(6, 'acc-menu-link'),
            $elem = $(this),
            $sub = $elem.children('[data-submenu]'),
            subId = $sub[0].id || Foundation.GetYoDigits(6, 'acc-menu'),
            isActive = $sub.hasClass('is-active');
        $elem.attr({
          'aria-controls': subId,
          'aria-expanded': isActive,
          'role': 'menuitem',
          'id': linkId
        });
        $sub.attr({
          'aria-labelledby': linkId,
          'aria-hidden': !isActive,
          'role': 'menu',
          'id': subId
        });
      });
      var initPanes = this.$element.find('.is-active');
      if (initPanes.length) {
        var _this = this;
        initPanes.each(function () {
          _this.down($(this));
        });
      }
      this._events();
    }

    /**
     * Adds event handlers for items within the menu.
     * @private
     */
    _events() {
      var _this = this;

      this.$element.find('li').each(function () {
        var $submenu = $(this).children('[data-submenu]');

        if ($submenu.length) {
          $(this).children('a').off('click.zf.accordionMenu').on('click.zf.accordionMenu', function (e) {
            e.preventDefault();

            _this.toggle($submenu);
          });
        }
      }).on('keydown.zf.accordionmenu', function (e) {
        var $element = $(this),
            $elements = $element.parent('ul').children('li'),
            $prevElement,
            $nextElement,
            $target = $element.children('[data-submenu]');

        $elements.each(function (i) {
          if ($(this).is($element)) {
            $prevElement = $elements.eq(Math.max(0, i - 1)).find('a').first();
            $nextElement = $elements.eq(Math.min(i + 1, $elements.length - 1)).find('a').first();

            if ($(this).children('[data-submenu]:visible').length) {
              // has open sub menu
              $nextElement = $element.find('li:first-child').find('a').first();
            }
            if ($(this).is(':first-child')) {
              // is first element of sub menu
              $prevElement = $element.parents('li').first().find('a').first();
            } else if ($prevElement.parents('li').first().children('[data-submenu]:visible').length) {
              // if previous element has open sub menu
              $prevElement = $prevElement.parents('li').find('li:last-child').find('a').first();
            }
            if ($(this).is(':last-child')) {
              // is last element of sub menu
              $nextElement = $element.parents('li').first().next('li').find('a').first();
            }

            return;
          }
        });

        Foundation.Keyboard.handleKey(e, 'AccordionMenu', {
          open: function () {
            if ($target.is(':hidden')) {
              _this.down($target);
              $target.find('li').first().find('a').first().focus();
            }
          },
          close: function () {
            if ($target.length && !$target.is(':hidden')) {
              // close active sub of this item
              _this.up($target);
            } else if ($element.parent('[data-submenu]').length) {
              // close currently open sub
              _this.up($element.parent('[data-submenu]'));
              $element.parents('li').first().find('a').first().focus();
            }
          },
          up: function () {
            $prevElement.focus();
            return true;
          },
          down: function () {
            $nextElement.focus();
            return true;
          },
          toggle: function () {
            if ($element.children('[data-submenu]').length) {
              _this.toggle($element.children('[data-submenu]'));
            }
          },
          closeAll: function () {
            _this.hideAll();
          },
          handled: function (preventDefault) {
            if (preventDefault) {
              e.preventDefault();
            }
            e.stopImmediatePropagation();
          }
        });
      }); //.attr('tabindex', 0);
    }

    /**
     * Closes all panes of the menu.
     * @function
     */
    hideAll() {
      this.up(this.$element.find('[data-submenu]'));
    }

    /**
     * Opens all panes of the menu.
     * @function
     */
    showAll() {
      this.down(this.$element.find('[data-submenu]'));
    }

    /**
     * Toggles the open/close state of a submenu.
     * @function
     * @param {jQuery} $target - the submenu to toggle
     */
    toggle($target) {
      if (!$target.is(':animated')) {
        if (!$target.is(':hidden')) {
          this.up($target);
        } else {
          this.down($target);
        }
      }
    }

    /**
     * Opens the sub-menu defined by `$target`.
     * @param {jQuery} $target - Sub-menu to open.
     * @fires AccordionMenu#down
     */
    down($target) {
      var _this = this;

      if (!this.options.multiOpen) {
        this.up(this.$element.find('.is-active').not($target.parentsUntil(this.$element).add($target)));
      }

      $target.addClass('is-active').attr({ 'aria-hidden': false }).parent('.is-accordion-submenu-parent').attr({ 'aria-expanded': true });

      //Foundation.Move(this.options.slideSpeed, $target, function() {
      $target.slideDown(_this.options.slideSpeed, function () {
        /**
         * Fires when the menu is done opening.
         * @event AccordionMenu#down
         */
        _this.$element.trigger('down.zf.accordionMenu', [$target]);
      });
      //});
    }

    /**
     * Closes the sub-menu defined by `$target`. All sub-menus inside the target will be closed as well.
     * @param {jQuery} $target - Sub-menu to close.
     * @fires AccordionMenu#up
     */
    up($target) {
      var _this = this;
      //Foundation.Move(this.options.slideSpeed, $target, function(){
      $target.slideUp(_this.options.slideSpeed, function () {
        /**
         * Fires when the menu is done collapsing up.
         * @event AccordionMenu#up
         */
        _this.$element.trigger('up.zf.accordionMenu', [$target]);
      });
      //});

      var $menus = $target.find('[data-submenu]').slideUp(0).addBack().attr('aria-hidden', true);

      $menus.parent('.is-accordion-submenu-parent').attr('aria-expanded', false);
    }

    /**
     * Destroys an instance of accordion menu.
     * @fires AccordionMenu#destroyed
     */
    destroy() {
      this.$element.find('[data-submenu]').slideDown(0).css('display', '');
      this.$element.find('a').off('click.zf.accordionMenu');

      Foundation.Nest.Burn(this.$element, 'accordion');
      Foundation.unregisterPlugin(this);
    }
  }

  AccordionMenu.defaults = {
    /**
     * Amount of time to animate the opening of a submenu in ms.
     * @option
     * @example 250
     */
    slideSpeed: 250,
    /**
     * Allow the menu to have multiple open panes.
     * @option
     * @example true
     */
    multiOpen: true
  };

  // Window exports
  Foundation.plugin(AccordionMenu, 'AccordionMenu');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * Drilldown module.
   * @module foundation.drilldown
   * @requires foundation.util.keyboard
   * @requires foundation.util.motion
   * @requires foundation.util.nest
   */

  class Drilldown {
    /**
     * Creates a new instance of a drilldown menu.
     * @class
     * @param {jQuery} element - jQuery object to make into an accordion menu.
     * @param {Object} options - Overrides to the default plugin settings.
     */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, Drilldown.defaults, this.$element.data(), options);

      Foundation.Nest.Feather(this.$element, 'drilldown');

      this._init();

      Foundation.registerPlugin(this, 'Drilldown');
      Foundation.Keyboard.register('Drilldown', {
        'ENTER': 'open',
        'SPACE': 'open',
        'ARROW_RIGHT': 'next',
        'ARROW_UP': 'up',
        'ARROW_DOWN': 'down',
        'ARROW_LEFT': 'previous',
        'ESCAPE': 'close',
        'TAB': 'down',
        'SHIFT_TAB': 'up'
      });
    }

    /**
     * Initializes the drilldown by creating jQuery collections of elements
     * @private
     */
    _init() {
      this.$submenuAnchors = this.$element.find('li.is-drilldown-submenu-parent').children('a');
      this.$submenus = this.$submenuAnchors.parent('li').children('[data-submenu]');
      this.$menuItems = this.$element.find('li').not('.js-drilldown-back').attr('role', 'menuitem').find('a');
      this.$element.attr('data-mutate', this.$element.attr('data-drilldown') || Foundation.GetYoDigits(6, 'drilldown'));

      this._prepareMenu();
      this._registerEvents();

      this._keyboardEvents();
    }

    /**
     * prepares drilldown menu by setting attributes to links and elements
     * sets a min height to prevent content jumping
     * wraps the element if not already wrapped
     * @private
     * @function
     */
    _prepareMenu() {
      var _this = this;
      // if(!this.options.holdOpen){
      //   this._menuLinkEvents();
      // }
      this.$submenuAnchors.each(function () {
        var $link = $(this);
        var $sub = $link.parent();
        if (_this.options.parentLink) {
          $link.clone().prependTo($sub.children('[data-submenu]')).wrap('<li class="is-submenu-parent-item is-submenu-item is-drilldown-submenu-item" role="menu-item"></li>');
        }
        $link.data('savedHref', $link.attr('href')).removeAttr('href').attr('tabindex', 0);
        $link.children('[data-submenu]').attr({
          'aria-hidden': true,
          'tabindex': 0,
          'role': 'menu'
        });
        _this._events($link);
      });
      this.$submenus.each(function () {
        var $menu = $(this),
            $back = $menu.find('.js-drilldown-back');
        if (!$back.length) {
          switch (_this.options.backButtonPosition) {
            case "bottom":
              $menu.append(_this.options.backButton);
              break;
            case "top":
              $menu.prepend(_this.options.backButton);
              break;
            default:
              console.error("Unsupported backButtonPosition value '" + _this.options.backButtonPosition + "'");
          }
        }
        _this._back($menu);
      });

      if (!this.options.autoHeight) {
        this.$submenus.addClass('drilldown-submenu-cover-previous');
      }

      if (!this.$element.parent().hasClass('is-drilldown')) {
        this.$wrapper = $(this.options.wrapper).addClass('is-drilldown');
        if (this.options.animateHeight) this.$wrapper.addClass('animate-height');
        this.$wrapper = this.$element.wrap(this.$wrapper).parent().css(this._getMaxDims());
      }
    }

    _resize() {
      this.$wrapper.css({ 'max-width': 'none', 'min-height': 'none' });
      // _getMaxDims has side effects (boo) but calling it should update all other necessary heights & widths
      this.$wrapper.css(this._getMaxDims());
    }

    /**
     * Adds event handlers to elements in the menu.
     * @function
     * @private
     * @param {jQuery} $elem - the current menu item to add handlers to.
     */
    _events($elem) {
      var _this = this;

      $elem.off('click.zf.drilldown').on('click.zf.drilldown', function (e) {
        if ($(e.target).parentsUntil('ul', 'li').hasClass('is-drilldown-submenu-parent')) {
          e.stopImmediatePropagation();
          e.preventDefault();
        }

        // if(e.target !== e.currentTarget.firstElementChild){
        //   return false;
        // }
        _this._show($elem.parent('li'));

        if (_this.options.closeOnClick) {
          var $body = $('body');
          $body.off('.zf.drilldown').on('click.zf.drilldown', function (e) {
            if (e.target === _this.$element[0] || $.contains(_this.$element[0], e.target)) {
              return;
            }
            e.preventDefault();
            _this._hideAll();
            $body.off('.zf.drilldown');
          });
        }
      });
      this.$element.on('mutateme.zf.trigger', this._resize.bind(this));
    }

    /**
     * Adds event handlers to the menu element.
     * @function
     * @private
     */
    _registerEvents() {
      if (this.options.scrollTop) {
        this._bindHandler = this._scrollTop.bind(this);
        this.$element.on('open.zf.drilldown hide.zf.drilldown closed.zf.drilldown', this._bindHandler);
      }
    }

    /**
     * Scroll to Top of Element or data-scroll-top-element
     * @function
     * @fires Drilldown#scrollme
     */
    _scrollTop() {
      var _this = this;
      var $scrollTopElement = _this.options.scrollTopElement != '' ? $(_this.options.scrollTopElement) : _this.$element,
          scrollPos = parseInt($scrollTopElement.offset().top + _this.options.scrollTopOffset);
      $('html, body').stop(true).animate({ scrollTop: scrollPos }, _this.options.animationDuration, _this.options.animationEasing, function () {
        /**
          * Fires after the menu has scrolled
          * @event Drilldown#scrollme
          */
        if (this === $('html')[0]) _this.$element.trigger('scrollme.zf.drilldown');
      });
    }

    /**
     * Adds keydown event listener to `li`'s in the menu.
     * @private
     */
    _keyboardEvents() {
      var _this = this;

      this.$menuItems.add(this.$element.find('.js-drilldown-back > a, .is-submenu-parent-item > a')).on('keydown.zf.drilldown', function (e) {
        var $element = $(this),
            $elements = $element.parent('li').parent('ul').children('li').children('a'),
            $prevElement,
            $nextElement;

        $elements.each(function (i) {
          if ($(this).is($element)) {
            $prevElement = $elements.eq(Math.max(0, i - 1));
            $nextElement = $elements.eq(Math.min(i + 1, $elements.length - 1));
            return;
          }
        });

        Foundation.Keyboard.handleKey(e, 'Drilldown', {
          next: function () {
            if ($element.is(_this.$submenuAnchors)) {
              _this._show($element.parent('li'));
              $element.parent('li').one(Foundation.transitionend($element), function () {
                $element.parent('li').find('ul li a').filter(_this.$menuItems).first().focus();
              });
              return true;
            }
          },
          previous: function () {
            _this._hide($element.parent('li').parent('ul'));
            $element.parent('li').parent('ul').one(Foundation.transitionend($element), function () {
              setTimeout(function () {
                $element.parent('li').parent('ul').parent('li').children('a').first().focus();
              }, 1);
            });
            return true;
          },
          up: function () {
            $prevElement.focus();
            return true;
          },
          down: function () {
            $nextElement.focus();
            return true;
          },
          close: function () {
            _this._back();
            //_this.$menuItems.first().focus(); // focus to first element
          },
          open: function () {
            if (!$element.is(_this.$menuItems)) {
              // not menu item means back button
              _this._hide($element.parent('li').parent('ul'));
              $element.parent('li').parent('ul').one(Foundation.transitionend($element), function () {
                setTimeout(function () {
                  $element.parent('li').parent('ul').parent('li').children('a').first().focus();
                }, 1);
              });
              return true;
            } else if ($element.is(_this.$submenuAnchors)) {
              _this._show($element.parent('li'));
              $element.parent('li').one(Foundation.transitionend($element), function () {
                $element.parent('li').find('ul li a').filter(_this.$menuItems).first().focus();
              });
              return true;
            }
          },
          handled: function (preventDefault) {
            if (preventDefault) {
              e.preventDefault();
            }
            e.stopImmediatePropagation();
          }
        });
      }); // end keyboardAccess
    }

    /**
     * Closes all open elements, and returns to root menu.
     * @function
     * @fires Drilldown#closed
     */
    _hideAll() {
      var $elem = this.$element.find('.is-drilldown-submenu.is-active').addClass('is-closing');
      if (this.options.autoHeight) this.$wrapper.css({ height: $elem.parent().closest('ul').data('calcHeight') });
      $elem.one(Foundation.transitionend($elem), function (e) {
        $elem.removeClass('is-active is-closing');
      });
      /**
       * Fires when the menu is fully closed.
       * @event Drilldown#closed
       */
      this.$element.trigger('closed.zf.drilldown');
    }

    /**
     * Adds event listener for each `back` button, and closes open menus.
     * @function
     * @fires Drilldown#back
     * @param {jQuery} $elem - the current sub-menu to add `back` event.
     */
    _back($elem) {
      var _this = this;
      $elem.off('click.zf.drilldown');
      $elem.children('.js-drilldown-back').on('click.zf.drilldown', function (e) {
        e.stopImmediatePropagation();
        // console.log('mouseup on back');
        _this._hide($elem);

        // If there is a parent submenu, call show
        let parentSubMenu = $elem.parent('li').parent('ul').parent('li');
        if (parentSubMenu.length) {
          _this._show(parentSubMenu);
        }
      });
    }

    /**
     * Adds event listener to menu items w/o submenus to close open menus on click.
     * @function
     * @private
     */
    _menuLinkEvents() {
      var _this = this;
      this.$menuItems.not('.is-drilldown-submenu-parent').off('click.zf.drilldown').on('click.zf.drilldown', function (e) {
        // e.stopImmediatePropagation();
        setTimeout(function () {
          _this._hideAll();
        }, 0);
      });
    }

    /**
     * Opens a submenu.
     * @function
     * @fires Drilldown#open
     * @param {jQuery} $elem - the current element with a submenu to open, i.e. the `li` tag.
     */
    _show($elem) {
      if (this.options.autoHeight) this.$wrapper.css({ height: $elem.children('[data-submenu]').data('calcHeight') });
      $elem.attr('aria-expanded', true);
      $elem.children('[data-submenu]').addClass('is-active').attr('aria-hidden', false);
      /**
       * Fires when the submenu has opened.
       * @event Drilldown#open
       */
      this.$element.trigger('open.zf.drilldown', [$elem]);
    }

    /**
     * Hides a submenu
     * @function
     * @fires Drilldown#hide
     * @param {jQuery} $elem - the current sub-menu to hide, i.e. the `ul` tag.
     */
    _hide($elem) {
      if (this.options.autoHeight) this.$wrapper.css({ height: $elem.parent().closest('ul').data('calcHeight') });
      var _this = this;
      $elem.parent('li').attr('aria-expanded', false);
      $elem.attr('aria-hidden', true).addClass('is-closing');
      $elem.addClass('is-closing').one(Foundation.transitionend($elem), function () {
        $elem.removeClass('is-active is-closing');
        $elem.blur();
      });
      /**
       * Fires when the submenu has closed.
       * @event Drilldown#hide
       */
      $elem.trigger('hide.zf.drilldown', [$elem]);
    }

    /**
     * Iterates through the nested menus to calculate the min-height, and max-width for the menu.
     * Prevents content jumping.
     * @function
     * @private
     */
    _getMaxDims() {
      var maxHeight = 0,
          result = {},
          _this = this;
      this.$submenus.add(this.$element).each(function () {
        var numOfElems = $(this).children('li').length;
        var height = Foundation.Box.GetDimensions(this).height;
        maxHeight = height > maxHeight ? height : maxHeight;
        if (_this.options.autoHeight) {
          $(this).data('calcHeight', height);
          if (!$(this).hasClass('is-drilldown-submenu')) result['height'] = height;
        }
      });

      if (!this.options.autoHeight) result['min-height'] = `${maxHeight}px`;

      result['max-width'] = `${this.$element[0].getBoundingClientRect().width}px`;

      return result;
    }

    /**
     * Destroys the Drilldown Menu
     * @function
     */
    destroy() {
      if (this.options.scrollTop) this.$element.off('.zf.drilldown', this._bindHandler);
      this._hideAll();
      this.$element.off('mutateme.zf.trigger');
      Foundation.Nest.Burn(this.$element, 'drilldown');
      this.$element.unwrap().find('.js-drilldown-back, .is-submenu-parent-item').remove().end().find('.is-active, .is-closing, .is-drilldown-submenu').removeClass('is-active is-closing is-drilldown-submenu').end().find('[data-submenu]').removeAttr('aria-hidden tabindex role');
      this.$submenuAnchors.each(function () {
        $(this).off('.zf.drilldown');
      });

      this.$submenus.removeClass('drilldown-submenu-cover-previous');

      this.$element.find('a').each(function () {
        var $link = $(this);
        $link.removeAttr('tabindex');
        if ($link.data('savedHref')) {
          $link.attr('href', $link.data('savedHref')).removeData('savedHref');
        } else {
          return;
        }
      });
      Foundation.unregisterPlugin(this);
    }
  }

  Drilldown.defaults = {
    /**
     * Markup used for JS generated back button. Prepended  or appended (see backButtonPosition) to submenu lists and deleted on `destroy` method, 'js-drilldown-back' class required. Remove the backslash (`\`) if copy and pasting.
     * @option
     * @example '<\li><\a>Back<\/a><\/li>'
     */
    backButton: '<li class="js-drilldown-back"><a tabindex="0">Back</a></li>',
    /**
     * Position the back button either at the top or bottom of drilldown submenus.
     * @option
     * @example bottom
     */
    backButtonPosition: 'top',
    /**
     * Markup used to wrap drilldown menu. Use a class name for independent styling; the JS applied class: `is-drilldown` is required. Remove the backslash (`\`) if copy and pasting.
     * @option
     * @example '<\div class="is-drilldown"><\/div>'
     */
    wrapper: '<div></div>',
    /**
     * Adds the parent link to the submenu.
     * @option
     * @example false
     */
    parentLink: false,
    /**
     * Allow the menu to return to root list on body click.
     * @option
     * @example false
     */
    closeOnClick: false,
    /**
     * Allow the menu to auto adjust height.
     * @option
     * @example false
     */
    autoHeight: false,
    /**
     * Animate the auto adjust height.
     * @option
     * @example false
     */
    animateHeight: false,
    /**
     * Scroll to the top of the menu after opening a submenu or navigating back using the menu back button
     * @option
     * @example false
     */
    scrollTop: false,
    /**
     * String jquery selector (for example 'body') of element to take offset().top from, if empty string the drilldown menu offset().top is taken
     * @option
     * @example ''
     */
    scrollTopElement: '',
    /**
     * ScrollTop offset
     * @option
     * @example 100
     */
    scrollTopOffset: 0,
    /**
     * Scroll animation duration
     * @option
     * @example 500
     */
    animationDuration: 500,
    /**
     * Scroll animation easing
     * @option
     * @example 'swing'
     */
    animationEasing: 'swing'
    // holdOpen: false
  };

  // Window exports
  Foundation.plugin(Drilldown, 'Drilldown');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * Dropdown module.
   * @module foundation.dropdown
   * @requires foundation.util.keyboard
   * @requires foundation.util.box
   * @requires foundation.util.triggers
   */

  class Dropdown {
    /**
     * Creates a new instance of a dropdown.
     * @class
     * @param {jQuery} element - jQuery object to make into a dropdown.
     *        Object should be of the dropdown panel, rather than its anchor.
     * @param {Object} options - Overrides to the default plugin settings.
     */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, Dropdown.defaults, this.$element.data(), options);
      this._init();

      Foundation.registerPlugin(this, 'Dropdown');
      Foundation.Keyboard.register('Dropdown', {
        'ENTER': 'open',
        'SPACE': 'open',
        'ESCAPE': 'close'
      });
    }

    /**
     * Initializes the plugin by setting/checking options and attributes, adding helper variables, and saving the anchor.
     * @function
     * @private
     */
    _init() {
      var $id = this.$element.attr('id');

      this.$anchor = $(`[data-toggle="${$id}"]`).length ? $(`[data-toggle="${$id}"]`) : $(`[data-open="${$id}"]`);
      this.$anchor.attr({
        'aria-controls': $id,
        'data-is-focus': false,
        'data-yeti-box': $id,
        'aria-haspopup': true,
        'aria-expanded': false

      });

      if (this.options.parentClass) {
        this.$parent = this.$element.parents('.' + this.options.parentClass);
      } else {
        this.$parent = null;
      }
      this.options.positionClass = this.getPositionClass();
      this.counter = 4;
      this.usedPositions = [];
      this.$element.attr({
        'aria-hidden': 'true',
        'data-yeti-box': $id,
        'data-resize': $id,
        'aria-labelledby': this.$anchor[0].id || Foundation.GetYoDigits(6, 'dd-anchor')
      });
      this._events();
    }

    /**
     * Helper function to determine current orientation of dropdown pane.
     * @function
     * @returns {String} position - string value of a position class.
     */
    getPositionClass() {
      var verticalPosition = this.$element[0].className.match(/(top|left|right|bottom)/g);
      verticalPosition = verticalPosition ? verticalPosition[0] : '';
      var horizontalPosition = /float-(\S+)/.exec(this.$anchor[0].className);
      horizontalPosition = horizontalPosition ? horizontalPosition[1] : '';
      var position = horizontalPosition ? horizontalPosition + ' ' + verticalPosition : verticalPosition;

      return position;
    }

    /**
     * Adjusts the dropdown panes orientation by adding/removing positioning classes.
     * @function
     * @private
     * @param {String} position - position class to remove.
     */
    _reposition(position) {
      this.usedPositions.push(position ? position : 'bottom');
      //default, try switching to opposite side
      if (!position && this.usedPositions.indexOf('top') < 0) {
        this.$element.addClass('top');
      } else if (position === 'top' && this.usedPositions.indexOf('bottom') < 0) {
        this.$element.removeClass(position);
      } else if (position === 'left' && this.usedPositions.indexOf('right') < 0) {
        this.$element.removeClass(position).addClass('right');
      } else if (position === 'right' && this.usedPositions.indexOf('left') < 0) {
        this.$element.removeClass(position).addClass('left');
      }

      //if default change didn't work, try bottom or left first
      else if (!position && this.usedPositions.indexOf('top') > -1 && this.usedPositions.indexOf('left') < 0) {
          this.$element.addClass('left');
        } else if (position === 'top' && this.usedPositions.indexOf('bottom') > -1 && this.usedPositions.indexOf('left') < 0) {
          this.$element.removeClass(position).addClass('left');
        } else if (position === 'left' && this.usedPositions.indexOf('right') > -1 && this.usedPositions.indexOf('bottom') < 0) {
          this.$element.removeClass(position);
        } else if (position === 'right' && this.usedPositions.indexOf('left') > -1 && this.usedPositions.indexOf('bottom') < 0) {
          this.$element.removeClass(position);
        }
        //if nothing cleared, set to bottom
        else {
            this.$element.removeClass(position);
          }
      this.classChanged = true;
      this.counter--;
    }

    /**
     * Sets the position and orientation of the dropdown pane, checks for collisions.
     * Recursively calls itself if a collision is detected, with a new position class.
     * @function
     * @private
     */
    _setPosition() {
      if (this.$anchor.attr('aria-expanded') === 'false') {
        return false;
      }
      var position = this.getPositionClass(),
          $eleDims = Foundation.Box.GetDimensions(this.$element),
          $anchorDims = Foundation.Box.GetDimensions(this.$anchor),
          _this = this,
          direction = position === 'left' ? 'left' : position === 'right' ? 'left' : 'top',
          param = direction === 'top' ? 'height' : 'width',
          offset = param === 'height' ? this.options.vOffset : this.options.hOffset;

      if ($eleDims.width >= $eleDims.windowDims.width || !this.counter && !Foundation.Box.ImNotTouchingYou(this.$element, this.$parent)) {
        var newWidth = $eleDims.windowDims.width,
            parentHOffset = 0;
        if (this.$parent) {
          var $parentDims = Foundation.Box.GetDimensions(this.$parent),
              parentHOffset = $parentDims.offset.left;
          if ($parentDims.width < newWidth) {
            newWidth = $parentDims.width;
          }
        }

        this.$element.offset(Foundation.Box.GetOffsets(this.$element, this.$anchor, 'center bottom', this.options.vOffset, this.options.hOffset + parentHOffset, true)).css({
          'width': newWidth - this.options.hOffset * 2,
          'height': 'auto'
        });
        this.classChanged = true;
        return false;
      }

      this.$element.offset(Foundation.Box.GetOffsets(this.$element, this.$anchor, position, this.options.vOffset, this.options.hOffset));

      while (!Foundation.Box.ImNotTouchingYou(this.$element, this.$parent, true) && this.counter) {
        this._reposition(position);
        this._setPosition();
      }
    }

    /**
     * Adds event listeners to the element utilizing the triggers utility library.
     * @function
     * @private
     */
    _events() {
      var _this = this;
      this.$element.on({
        'open.zf.trigger': this.open.bind(this),
        'close.zf.trigger': this.close.bind(this),
        'toggle.zf.trigger': this.toggle.bind(this),
        'resizeme.zf.trigger': this._setPosition.bind(this)
      });

      if (this.options.hover) {
        this.$anchor.off('mouseenter.zf.dropdown mouseleave.zf.dropdown').on('mouseenter.zf.dropdown', function () {
          var bodyData = $('body').data();
          if (typeof bodyData.whatinput === 'undefined' || bodyData.whatinput === 'mouse') {
            clearTimeout(_this.timeout);
            _this.timeout = setTimeout(function () {
              _this.open();
              _this.$anchor.data('hover', true);
            }, _this.options.hoverDelay);
          }
        }).on('mouseleave.zf.dropdown', function () {
          clearTimeout(_this.timeout);
          _this.timeout = setTimeout(function () {
            _this.close();
            _this.$anchor.data('hover', false);
          }, _this.options.hoverDelay);
        });
        if (this.options.hoverPane) {
          this.$element.off('mouseenter.zf.dropdown mouseleave.zf.dropdown').on('mouseenter.zf.dropdown', function () {
            clearTimeout(_this.timeout);
          }).on('mouseleave.zf.dropdown', function () {
            clearTimeout(_this.timeout);
            _this.timeout = setTimeout(function () {
              _this.close();
              _this.$anchor.data('hover', false);
            }, _this.options.hoverDelay);
          });
        }
      }
      this.$anchor.add(this.$element).on('keydown.zf.dropdown', function (e) {

        var $target = $(this),
            visibleFocusableElements = Foundation.Keyboard.findFocusable(_this.$element);

        Foundation.Keyboard.handleKey(e, 'Dropdown', {
          open: function () {
            if ($target.is(_this.$anchor)) {
              _this.open();
              _this.$element.attr('tabindex', -1).focus();
              e.preventDefault();
            }
          },
          close: function () {
            _this.close();
            _this.$anchor.focus();
          }
        });
      });
    }

    /**
     * Adds an event handler to the body to close any dropdowns on a click.
     * @function
     * @private
     */
    _addBodyHandler() {
      var $body = $(document.body).not(this.$element),
          _this = this;
      $body.off('click.zf.dropdown').on('click.zf.dropdown', function (e) {
        if (_this.$anchor.is(e.target) || _this.$anchor.find(e.target).length) {
          return;
        }
        if (_this.$element.find(e.target).length) {
          return;
        }
        _this.close();
        $body.off('click.zf.dropdown');
      });
    }

    /**
     * Opens the dropdown pane, and fires a bubbling event to close other dropdowns.
     * @function
     * @fires Dropdown#closeme
     * @fires Dropdown#show
     */
    open() {
      // var _this = this;
      /**
       * Fires to close other open dropdowns
       * @event Dropdown#closeme
       */
      this.$element.trigger('closeme.zf.dropdown', this.$element.attr('id'));
      this.$anchor.addClass('hover').attr({ 'aria-expanded': true });
      // this.$element/*.show()*/;
      this._setPosition();
      this.$element.addClass('is-open').attr({ 'aria-hidden': false });

      if (this.options.autoFocus) {
        var $focusable = Foundation.Keyboard.findFocusable(this.$element);
        if ($focusable.length) {
          $focusable.eq(0).focus();
        }
      }

      if (this.options.closeOnClick) {
        this._addBodyHandler();
      }

      if (this.options.trapFocus) {
        Foundation.Keyboard.trapFocus(this.$element);
      }

      /**
       * Fires once the dropdown is visible.
       * @event Dropdown#show
       */
      this.$element.trigger('show.zf.dropdown', [this.$element]);
    }

    /**
     * Closes the open dropdown pane.
     * @function
     * @fires Dropdown#hide
     */
    close() {
      if (!this.$element.hasClass('is-open')) {
        return false;
      }
      this.$element.removeClass('is-open').attr({ 'aria-hidden': true });

      this.$anchor.removeClass('hover').attr('aria-expanded', false);

      if (this.classChanged) {
        var curPositionClass = this.getPositionClass();
        if (curPositionClass) {
          this.$element.removeClass(curPositionClass);
        }
        this.$element.addClass(this.options.positionClass)
        /*.hide()*/.css({ height: '', width: '' });
        this.classChanged = false;
        this.counter = 4;
        this.usedPositions.length = 0;
      }
      this.$element.trigger('hide.zf.dropdown', [this.$element]);

      if (this.options.trapFocus) {
        Foundation.Keyboard.releaseFocus(this.$element);
      }
    }

    /**
     * Toggles the dropdown pane's visibility.
     * @function
     */
    toggle() {
      if (this.$element.hasClass('is-open')) {
        if (this.$anchor.data('hover')) return;
        this.close();
      } else {
        this.open();
      }
    }

    /**
     * Destroys the dropdown.
     * @function
     */
    destroy() {
      this.$element.off('.zf.trigger').hide();
      this.$anchor.off('.zf.dropdown');

      Foundation.unregisterPlugin(this);
    }
  }

  Dropdown.defaults = {
    /**
     * Class that designates bounding container of Dropdown (Default: window)
     * @option
     * @example 'dropdown-parent'
     */
    parentClass: null,
    /**
     * Amount of time to delay opening a submenu on hover event.
     * @option
     * @example 250
     */
    hoverDelay: 250,
    /**
     * Allow submenus to open on hover events
     * @option
     * @example false
     */
    hover: false,
    /**
     * Don't close dropdown when hovering over dropdown pane
     * @option
     * @example true
     */
    hoverPane: false,
    /**
     * Number of pixels between the dropdown pane and the triggering element on open.
     * @option
     * @example 1
     */
    vOffset: 1,
    /**
     * Number of pixels between the dropdown pane and the triggering element on open.
     * @option
     * @example 1
     */
    hOffset: 1,
    /**
     * Class applied to adjust open position. JS will test and fill this in.
     * @option
     * @example 'top'
     */
    positionClass: '',
    /**
     * Allow the plugin to trap focus to the dropdown pane if opened with keyboard commands.
     * @option
     * @example false
     */
    trapFocus: false,
    /**
     * Allow the plugin to set focus to the first focusable element within the pane, regardless of method of opening.
     * @option
     * @example true
     */
    autoFocus: false,
    /**
     * Allows a click on the body to close the dropdown.
     * @option
     * @example false
     */
    closeOnClick: false
  };

  // Window exports
  Foundation.plugin(Dropdown, 'Dropdown');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * DropdownMenu module.
   * @module foundation.dropdown-menu
   * @requires foundation.util.keyboard
   * @requires foundation.util.box
   * @requires foundation.util.nest
   */

  class DropdownMenu {
    /**
     * Creates a new instance of DropdownMenu.
     * @class
     * @fires DropdownMenu#init
     * @param {jQuery} element - jQuery object to make into a dropdown menu.
     * @param {Object} options - Overrides to the default plugin settings.
     */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, DropdownMenu.defaults, this.$element.data(), options);

      Foundation.Nest.Feather(this.$element, 'dropdown');
      this._init();

      Foundation.registerPlugin(this, 'DropdownMenu');
      Foundation.Keyboard.register('DropdownMenu', {
        'ENTER': 'open',
        'SPACE': 'open',
        'ARROW_RIGHT': 'next',
        'ARROW_UP': 'up',
        'ARROW_DOWN': 'down',
        'ARROW_LEFT': 'previous',
        'ESCAPE': 'close'
      });
    }

    /**
     * Initializes the plugin, and calls _prepareMenu
     * @private
     * @function
     */
    _init() {
      var subs = this.$element.find('li.is-dropdown-submenu-parent');
      this.$element.children('.is-dropdown-submenu-parent').children('.is-dropdown-submenu').addClass('first-sub');

      this.$menuItems = this.$element.find('[role="menuitem"]');
      this.$tabs = this.$element.children('[role="menuitem"]');
      this.$tabs.find('ul.is-dropdown-submenu').addClass(this.options.verticalClass);

      if (this.$element.hasClass(this.options.rightClass) || this.options.alignment === 'right' || Foundation.rtl() || this.$element.parents('.top-bar-right').is('*')) {
        this.options.alignment = 'right';
        subs.addClass('opens-left');
      } else {
        subs.addClass('opens-right');
      }
      this.changed = false;
      this._events();
    }

    _isVertical() {
      return this.$tabs.css('display') === 'block';
    }

    /**
     * Adds event listeners to elements within the menu
     * @private
     * @function
     */
    _events() {
      var _this = this,
          hasTouch = 'ontouchstart' in window || typeof window.ontouchstart !== 'undefined',
          parClass = 'is-dropdown-submenu-parent';

      // used for onClick and in the keyboard handlers
      var handleClickFn = function (e) {
        var $elem = $(e.target).parentsUntil('ul', `.${parClass}`),
            hasSub = $elem.hasClass(parClass),
            hasClicked = $elem.attr('data-is-click') === 'true',
            $sub = $elem.children('.is-dropdown-submenu');

        if (hasSub) {
          if (hasClicked) {
            if (!_this.options.closeOnClick || !_this.options.clickOpen && !hasTouch || _this.options.forceFollow && hasTouch) {
              return;
            } else {
              e.stopImmediatePropagation();
              e.preventDefault();
              _this._hide($elem);
            }
          } else {
            e.preventDefault();
            e.stopImmediatePropagation();
            _this._show($sub);
            $elem.add($elem.parentsUntil(_this.$element, `.${parClass}`)).attr('data-is-click', true);
          }
        }
      };

      if (this.options.clickOpen || hasTouch) {
        this.$menuItems.on('click.zf.dropdownmenu touchstart.zf.dropdownmenu', handleClickFn);
      }

      // Handle Leaf element Clicks
      if (_this.options.closeOnClickInside) {
        this.$menuItems.on('click.zf.dropdownmenu touchend.zf.dropdownmenu', function (e) {
          var $elem = $(this),
              hasSub = $elem.hasClass(parClass);
          if (!hasSub) {
            _this._hide();
          }
        });
      }

      if (!this.options.disableHover) {
        this.$menuItems.on('mouseenter.zf.dropdownmenu', function (e) {
          var $elem = $(this),
              hasSub = $elem.hasClass(parClass);

          if (hasSub) {
            clearTimeout($elem.data('_delay'));
            $elem.data('_delay', setTimeout(function () {
              _this._show($elem.children('.is-dropdown-submenu'));
            }, _this.options.hoverDelay));
          }
        }).on('mouseleave.zf.dropdownmenu', function (e) {
          var $elem = $(this),
              hasSub = $elem.hasClass(parClass);
          if (hasSub && _this.options.autoclose) {
            if ($elem.attr('data-is-click') === 'true' && _this.options.clickOpen) {
              return false;
            }

            clearTimeout($elem.data('_delay'));
            $elem.data('_delay', setTimeout(function () {
              _this._hide($elem);
            }, _this.options.closingTime));
          }
        });
      }
      this.$menuItems.on('keydown.zf.dropdownmenu', function (e) {
        var $element = $(e.target).parentsUntil('ul', '[role="menuitem"]'),
            isTab = _this.$tabs.index($element) > -1,
            $elements = isTab ? _this.$tabs : $element.siblings('li').add($element),
            $prevElement,
            $nextElement;

        $elements.each(function (i) {
          if ($(this).is($element)) {
            $prevElement = $elements.eq(i - 1);
            $nextElement = $elements.eq(i + 1);
            return;
          }
        });

        var nextSibling = function () {
          if (!$element.is(':last-child')) {
            $nextElement.children('a:first').focus();
            e.preventDefault();
          }
        },
            prevSibling = function () {
          $prevElement.children('a:first').focus();
          e.preventDefault();
        },
            openSub = function () {
          var $sub = $element.children('ul.is-dropdown-submenu');
          if ($sub.length) {
            _this._show($sub);
            $element.find('li > a:first').focus();
            e.preventDefault();
          } else {
            return;
          }
        },
            closeSub = function () {
          //if ($element.is(':first-child')) {
          var close = $element.parent('ul').parent('li');
          close.children('a:first').focus();
          _this._hide(close);
          e.preventDefault();
          //}
        };
        var functions = {
          open: openSub,
          close: function () {
            _this._hide(_this.$element);
            _this.$menuItems.find('a:first').focus(); // focus to first element
            e.preventDefault();
          },
          handled: function () {
            e.stopImmediatePropagation();
          }
        };

        if (isTab) {
          if (_this._isVertical()) {
            // vertical menu
            if (Foundation.rtl()) {
              // right aligned
              $.extend(functions, {
                down: nextSibling,
                up: prevSibling,
                next: closeSub,
                previous: openSub
              });
            } else {
              // left aligned
              $.extend(functions, {
                down: nextSibling,
                up: prevSibling,
                next: openSub,
                previous: closeSub
              });
            }
          } else {
            // horizontal menu
            if (Foundation.rtl()) {
              // right aligned
              $.extend(functions, {
                next: prevSibling,
                previous: nextSibling,
                down: openSub,
                up: closeSub
              });
            } else {
              // left aligned
              $.extend(functions, {
                next: nextSibling,
                previous: prevSibling,
                down: openSub,
                up: closeSub
              });
            }
          }
        } else {
          // not tabs -> one sub
          if (Foundation.rtl()) {
            // right aligned
            $.extend(functions, {
              next: closeSub,
              previous: openSub,
              down: nextSibling,
              up: prevSibling
            });
          } else {
            // left aligned
            $.extend(functions, {
              next: openSub,
              previous: closeSub,
              down: nextSibling,
              up: prevSibling
            });
          }
        }
        Foundation.Keyboard.handleKey(e, 'DropdownMenu', functions);
      });
    }

    /**
     * Adds an event handler to the body to close any dropdowns on a click.
     * @function
     * @private
     */
    _addBodyHandler() {
      var $body = $(document.body),
          _this = this;
      $body.off('mouseup.zf.dropdownmenu touchend.zf.dropdownmenu').on('mouseup.zf.dropdownmenu touchend.zf.dropdownmenu', function (e) {
        var $link = _this.$element.find(e.target);
        if ($link.length) {
          return;
        }

        _this._hide();
        $body.off('mouseup.zf.dropdownmenu touchend.zf.dropdownmenu');
      });
    }

    /**
     * Opens a dropdown pane, and checks for collisions first.
     * @param {jQuery} $sub - ul element that is a submenu to show
     * @function
     * @private
     * @fires DropdownMenu#show
     */
    _show($sub) {
      var idx = this.$tabs.index(this.$tabs.filter(function (i, el) {
        return $(el).find($sub).length > 0;
      }));
      var $sibs = $sub.parent('li.is-dropdown-submenu-parent').siblings('li.is-dropdown-submenu-parent');
      this._hide($sibs, idx);
      $sub.css('visibility', 'hidden').addClass('js-dropdown-active').parent('li.is-dropdown-submenu-parent').addClass('is-active');
      var clear = Foundation.Box.ImNotTouchingYou($sub, null, true);
      if (!clear) {
        var oldClass = this.options.alignment === 'left' ? '-right' : '-left',
            $parentLi = $sub.parent('.is-dropdown-submenu-parent');
        $parentLi.removeClass(`opens${oldClass}`).addClass(`opens-${this.options.alignment}`);
        clear = Foundation.Box.ImNotTouchingYou($sub, null, true);
        if (!clear) {
          $parentLi.removeClass(`opens-${this.options.alignment}`).addClass('opens-inner');
        }
        this.changed = true;
      }
      $sub.css('visibility', '');
      if (this.options.closeOnClick) {
        this._addBodyHandler();
      }
      /**
       * Fires when the new dropdown pane is visible.
       * @event DropdownMenu#show
       */
      this.$element.trigger('show.zf.dropdownmenu', [$sub]);
    }

    /**
     * Hides a single, currently open dropdown pane, if passed a parameter, otherwise, hides everything.
     * @function
     * @param {jQuery} $elem - element with a submenu to hide
     * @param {Number} idx - index of the $tabs collection to hide
     * @private
     */
    _hide($elem, idx) {
      var $toClose;
      if ($elem && $elem.length) {
        $toClose = $elem;
      } else if (idx !== undefined) {
        $toClose = this.$tabs.not(function (i, el) {
          return i === idx;
        });
      } else {
        $toClose = this.$element;
      }
      var somethingToClose = $toClose.hasClass('is-active') || $toClose.find('.is-active').length > 0;

      if (somethingToClose) {
        $toClose.find('li.is-active').add($toClose).attr({
          'data-is-click': false
        }).removeClass('is-active');

        $toClose.find('ul.js-dropdown-active').removeClass('js-dropdown-active');

        if (this.changed || $toClose.find('opens-inner').length) {
          var oldClass = this.options.alignment === 'left' ? 'right' : 'left';
          $toClose.find('li.is-dropdown-submenu-parent').add($toClose).removeClass(`opens-inner opens-${this.options.alignment}`).addClass(`opens-${oldClass}`);
          this.changed = false;
        }
        /**
         * Fires when the open menus are closed.
         * @event DropdownMenu#hide
         */
        this.$element.trigger('hide.zf.dropdownmenu', [$toClose]);
      }
    }

    /**
     * Destroys the plugin.
     * @function
     */
    destroy() {
      this.$menuItems.off('.zf.dropdownmenu').removeAttr('data-is-click').removeClass('is-right-arrow is-left-arrow is-down-arrow opens-right opens-left opens-inner');
      $(document.body).off('.zf.dropdownmenu');
      Foundation.Nest.Burn(this.$element, 'dropdown');
      Foundation.unregisterPlugin(this);
    }
  }

  /**
   * Default settings for plugin
   */
  DropdownMenu.defaults = {
    /**
     * Disallows hover events from opening submenus
     * @option
     * @example false
     */
    disableHover: false,
    /**
     * Allow a submenu to automatically close on a mouseleave event, if not clicked open.
     * @option
     * @example true
     */
    autoclose: true,
    /**
     * Amount of time to delay opening a submenu on hover event.
     * @option
     * @example 50
     */
    hoverDelay: 50,
    /**
     * Allow a submenu to open/remain open on parent click event. Allows cursor to move away from menu.
     * @option
     * @example true
     */
    clickOpen: false,
    /**
     * Amount of time to delay closing a submenu on a mouseleave event.
     * @option
     * @example 500
     */

    closingTime: 500,
    /**
     * Position of the menu relative to what direction the submenus should open. Handled by JS.
     * @option
     * @example 'left'
     */
    alignment: 'left',
    /**
     * Allow clicks on the body to close any open submenus.
     * @option
     * @example true
     */
    closeOnClick: true,
    /**
     * Allow clicks on leaf anchor links to close any open submenus.
     * @option
     * @example true
     */
    closeOnClickInside: true,
    /**
     * Class applied to vertical oriented menus, Foundation default is `vertical`. Update this if using your own class.
     * @option
     * @example 'vertical'
     */
    verticalClass: 'vertical',
    /**
     * Class applied to right-side oriented menus, Foundation default is `align-right`. Update this if using your own class.
     * @option
     * @example 'align-right'
     */
    rightClass: 'align-right',
    /**
     * Boolean to force overide the clicking of links to perform default action, on second touch event for mobile.
     * @option
     * @example false
     */
    forceFollow: true
  };

  // Window exports
  Foundation.plugin(DropdownMenu, 'DropdownMenu');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * Equalizer module.
   * @module foundation.equalizer
   * @requires foundation.util.mediaQuery
   * @requires foundation.util.timerAndImageLoader if equalizer contains images
   */

  class Equalizer {
    /**
     * Creates a new instance of Equalizer.
     * @class
     * @fires Equalizer#init
     * @param {Object} element - jQuery object to add the trigger to.
     * @param {Object} options - Overrides to the default plugin settings.
     */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, Equalizer.defaults, this.$element.data(), options);

      this._init();

      Foundation.registerPlugin(this, 'Equalizer');
    }

    /**
     * Initializes the Equalizer plugin and calls functions to get equalizer functioning on load.
     * @private
     */
    _init() {
      var eqId = this.$element.attr('data-equalizer') || '';
      var $watched = this.$element.find(`[data-equalizer-watch="${eqId}"]`);

      this.$watched = $watched.length ? $watched : this.$element.find('[data-equalizer-watch]');
      this.$element.attr('data-resize', eqId || Foundation.GetYoDigits(6, 'eq'));
      this.$element.attr('data-mutate', eqId || Foundation.GetYoDigits(6, 'eq'));

      this.hasNested = this.$element.find('[data-equalizer]').length > 0;
      this.isNested = this.$element.parentsUntil(document.body, '[data-equalizer]').length > 0;
      this.isOn = false;
      this._bindHandler = {
        onResizeMeBound: this._onResizeMe.bind(this),
        onPostEqualizedBound: this._onPostEqualized.bind(this)
      };

      var imgs = this.$element.find('img');
      var tooSmall;
      if (this.options.equalizeOn) {
        tooSmall = this._checkMQ();
        $(window).on('changed.zf.mediaquery', this._checkMQ.bind(this));
      } else {
        this._events();
      }
      if (tooSmall !== undefined && tooSmall === false || tooSmall === undefined) {
        if (imgs.length) {
          Foundation.onImagesLoaded(imgs, this._reflow.bind(this));
        } else {
          this._reflow();
        }
      }
    }

    /**
     * Removes event listeners if the breakpoint is too small.
     * @private
     */
    _pauseEvents() {
      this.isOn = false;
      this.$element.off({
        '.zf.equalizer': this._bindHandler.onPostEqualizedBound,
        'resizeme.zf.trigger': this._bindHandler.onResizeMeBound,
        'mutateme.zf.trigger': this._bindHandler.onResizeMeBound
      });
    }

    /**
     * function to handle $elements resizeme.zf.trigger, with bound this on _bindHandler.onResizeMeBound
     * @private
     */
    _onResizeMe(e) {
      this._reflow();
    }

    /**
     * function to handle $elements postequalized.zf.equalizer, with bound this on _bindHandler.onPostEqualizedBound
     * @private
     */
    _onPostEqualized(e) {
      if (e.target !== this.$element[0]) {
        this._reflow();
      }
    }

    /**
     * Initializes events for Equalizer.
     * @private
     */
    _events() {
      var _this = this;
      this._pauseEvents();
      if (this.hasNested) {
        this.$element.on('postequalized.zf.equalizer', this._bindHandler.onPostEqualizedBound);
      } else {
        this.$element.on('resizeme.zf.trigger', this._bindHandler.onResizeMeBound);
        this.$element.on('mutateme.zf.trigger', this._bindHandler.onResizeMeBound);
      }
      this.isOn = true;
    }

    /**
     * Checks the current breakpoint to the minimum required size.
     * @private
     */
    _checkMQ() {
      var tooSmall = !Foundation.MediaQuery.is(this.options.equalizeOn);
      if (tooSmall) {
        if (this.isOn) {
          this._pauseEvents();
          this.$watched.css('height', 'auto');
        }
      } else {
        if (!this.isOn) {
          this._events();
        }
      }
      return tooSmall;
    }

    /**
     * A noop version for the plugin
     * @private
     */
    _killswitch() {
      return;
    }

    /**
     * Calls necessary functions to update Equalizer upon DOM change
     * @private
     */
    _reflow() {
      if (!this.options.equalizeOnStack) {
        if (this._isStacked()) {
          this.$watched.css('height', 'auto');
          return false;
        }
      }
      if (this.options.equalizeByRow) {
        this.getHeightsByRow(this.applyHeightByRow.bind(this));
      } else {
        this.getHeights(this.applyHeight.bind(this));
      }
    }

    /**
     * Manually determines if the first 2 elements are *NOT* stacked.
     * @private
     */
    _isStacked() {
      if (!this.$watched[0] || !this.$watched[1]) {
        return true;
      }
      return this.$watched[0].getBoundingClientRect().top !== this.$watched[1].getBoundingClientRect().top;
    }

    /**
     * Finds the outer heights of children contained within an Equalizer parent and returns them in an array
     * @param {Function} cb - A non-optional callback to return the heights array to.
     * @returns {Array} heights - An array of heights of children within Equalizer container
     */
    getHeights(cb) {
      var heights = [];
      for (var i = 0, len = this.$watched.length; i < len; i++) {
        this.$watched[i].style.height = 'auto';
        heights.push(this.$watched[i].offsetHeight);
      }
      cb(heights);
    }

    /**
     * Finds the outer heights of children contained within an Equalizer parent and returns them in an array
     * @param {Function} cb - A non-optional callback to return the heights array to.
     * @returns {Array} groups - An array of heights of children within Equalizer container grouped by row with element,height and max as last child
     */
    getHeightsByRow(cb) {
      var lastElTopOffset = this.$watched.length ? this.$watched.first().offset().top : 0,
          groups = [],
          group = 0;
      //group by Row
      groups[group] = [];
      for (var i = 0, len = this.$watched.length; i < len; i++) {
        this.$watched[i].style.height = 'auto';
        //maybe could use this.$watched[i].offsetTop
        var elOffsetTop = $(this.$watched[i]).offset().top;
        if (elOffsetTop != lastElTopOffset) {
          group++;
          groups[group] = [];
          lastElTopOffset = elOffsetTop;
        }
        groups[group].push([this.$watched[i], this.$watched[i].offsetHeight]);
      }

      for (var j = 0, ln = groups.length; j < ln; j++) {
        var heights = $(groups[j]).map(function () {
          return this[1];
        }).get();
        var max = Math.max.apply(null, heights);
        groups[j].push(max);
      }
      cb(groups);
    }

    /**
     * Changes the CSS height property of each child in an Equalizer parent to match the tallest
     * @param {array} heights - An array of heights of children within Equalizer container
     * @fires Equalizer#preequalized
     * @fires Equalizer#postequalized
     */
    applyHeight(heights) {
      var max = Math.max.apply(null, heights);
      /**
       * Fires before the heights are applied
       * @event Equalizer#preequalized
       */
      this.$element.trigger('preequalized.zf.equalizer');

      this.$watched.css('height', max);

      /**
       * Fires when the heights have been applied
       * @event Equalizer#postequalized
       */
      this.$element.trigger('postequalized.zf.equalizer');
    }

    /**
     * Changes the CSS height property of each child in an Equalizer parent to match the tallest by row
     * @param {array} groups - An array of heights of children within Equalizer container grouped by row with element,height and max as last child
     * @fires Equalizer#preequalized
     * @fires Equalizer#preequalizedrow
     * @fires Equalizer#postequalizedrow
     * @fires Equalizer#postequalized
     */
    applyHeightByRow(groups) {
      /**
       * Fires before the heights are applied
       */
      this.$element.trigger('preequalized.zf.equalizer');
      for (var i = 0, len = groups.length; i < len; i++) {
        var groupsILength = groups[i].length,
            max = groups[i][groupsILength - 1];
        if (groupsILength <= 2) {
          $(groups[i][0][0]).css({ 'height': 'auto' });
          continue;
        }
        /**
          * Fires before the heights per row are applied
          * @event Equalizer#preequalizedrow
          */
        this.$element.trigger('preequalizedrow.zf.equalizer');
        for (var j = 0, lenJ = groupsILength - 1; j < lenJ; j++) {
          $(groups[i][j][0]).css({ 'height': max });
        }
        /**
          * Fires when the heights per row have been applied
          * @event Equalizer#postequalizedrow
          */
        this.$element.trigger('postequalizedrow.zf.equalizer');
      }
      /**
       * Fires when the heights have been applied
       */
      this.$element.trigger('postequalized.zf.equalizer');
    }

    /**
     * Destroys an instance of Equalizer.
     * @function
     */
    destroy() {
      this._pauseEvents();
      this.$watched.css('height', 'auto');

      Foundation.unregisterPlugin(this);
    }
  }

  /**
   * Default settings for plugin
   */
  Equalizer.defaults = {
    /**
     * Enable height equalization when stacked on smaller screens.
     * @option
     * @example true
     */
    equalizeOnStack: false,
    /**
     * Enable height equalization row by row.
     * @option
     * @example false
     */
    equalizeByRow: false,
    /**
     * String representing the minimum breakpoint size the plugin should equalize heights on.
     * @option
     * @example 'medium'
     */
    equalizeOn: ''
  };

  // Window exports
  Foundation.plugin(Equalizer, 'Equalizer');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * Interchange module.
   * @module foundation.interchange
   * @requires foundation.util.mediaQuery
   * @requires foundation.util.timerAndImageLoader
   */

  class Interchange {
    /**
     * Creates a new instance of Interchange.
     * @class
     * @fires Interchange#init
     * @param {Object} element - jQuery object to add the trigger to.
     * @param {Object} options - Overrides to the default plugin settings.
     */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, Interchange.defaults, options);
      this.rules = [];
      this.currentPath = '';

      this._init();
      this._events();

      Foundation.registerPlugin(this, 'Interchange');
    }

    /**
     * Initializes the Interchange plugin and calls functions to get interchange functioning on load.
     * @function
     * @private
     */
    _init() {
      this._addBreakpoints();
      this._generateRules();
      this._reflow();
    }

    /**
     * Initializes events for Interchange.
     * @function
     * @private
     */
    _events() {
      $(window).on('resize.zf.interchange', Foundation.util.throttle(() => {
        this._reflow();
      }, 50));
    }

    /**
     * Calls necessary functions to update Interchange upon DOM change
     * @function
     * @private
     */
    _reflow() {
      var match;

      // Iterate through each rule, but only save the last match
      for (var i in this.rules) {
        if (this.rules.hasOwnProperty(i)) {
          var rule = this.rules[i];
          if (window.matchMedia(rule.query).matches) {
            match = rule;
          }
        }
      }

      if (match) {
        this.replace(match.path);
      }
    }

    /**
     * Gets the Foundation breakpoints and adds them to the Interchange.SPECIAL_QUERIES object.
     * @function
     * @private
     */
    _addBreakpoints() {
      for (var i in Foundation.MediaQuery.queries) {
        if (Foundation.MediaQuery.queries.hasOwnProperty(i)) {
          var query = Foundation.MediaQuery.queries[i];
          Interchange.SPECIAL_QUERIES[query.name] = query.value;
        }
      }
    }

    /**
     * Checks the Interchange element for the provided media query + content pairings
     * @function
     * @private
     * @param {Object} element - jQuery object that is an Interchange instance
     * @returns {Array} scenarios - Array of objects that have 'mq' and 'path' keys with corresponding keys
     */
    _generateRules(element) {
      var rulesList = [];
      var rules;

      if (this.options.rules) {
        rules = this.options.rules;
      } else {
        rules = this.$element.data('interchange').match(/\[.*?\]/g);
      }

      for (var i in rules) {
        if (rules.hasOwnProperty(i)) {
          var rule = rules[i].slice(1, -1).split(', ');
          var path = rule.slice(0, -1).join('');
          var query = rule[rule.length - 1];

          if (Interchange.SPECIAL_QUERIES[query]) {
            query = Interchange.SPECIAL_QUERIES[query];
          }

          rulesList.push({
            path: path,
            query: query
          });
        }
      }

      this.rules = rulesList;
    }

    /**
     * Update the `src` property of an image, or change the HTML of a container, to the specified path.
     * @function
     * @param {String} path - Path to the image or HTML partial.
     * @fires Interchange#replaced
     */
    replace(path) {
      if (this.currentPath === path) return;

      var _this = this,
          trigger = 'replaced.zf.interchange';

      // Replacing images
      if (this.$element[0].nodeName === 'IMG') {
        this.$element.attr('src', path).on('load', function () {
          _this.currentPath = path;
        }).trigger(trigger);
      }
      // Replacing background images
      else if (path.match(/\.(gif|jpg|jpeg|png|svg|tiff)([?#].*)?/i)) {
          this.$element.css({ 'background-image': 'url(' + path + ')' }).trigger(trigger);
        }
        // Replacing HTML
        else {
            $.get(path, function (response) {
              _this.$element.html(response).trigger(trigger);
              $(response).foundation();
              _this.currentPath = path;
            });
          }

      /**
       * Fires when content in an Interchange element is done being loaded.
       * @event Interchange#replaced
       */
      // this.$element.trigger('replaced.zf.interchange');
    }

    /**
     * Destroys an instance of interchange.
     * @function
     */
    destroy() {
      //TODO this.
    }
  }

  /**
   * Default settings for plugin
   */
  Interchange.defaults = {
    /**
     * Rules to be applied to Interchange elements. Set with the `data-interchange` array notation.
     * @option
     */
    rules: null
  };

  Interchange.SPECIAL_QUERIES = {
    'landscape': 'screen and (orientation: landscape)',
    'portrait': 'screen and (orientation: portrait)',
    'retina': 'only screen and (-webkit-min-device-pixel-ratio: 2), only screen and (min--moz-device-pixel-ratio: 2), only screen and (-o-min-device-pixel-ratio: 2/1), only screen and (min-device-pixel-ratio: 2), only screen and (min-resolution: 192dpi), only screen and (min-resolution: 2dppx)'
  };

  // Window exports
  Foundation.plugin(Interchange, 'Interchange');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * Magellan module.
   * @module foundation.magellan
   */

  class Magellan {
    /**
     * Creates a new instance of Magellan.
     * @class
     * @fires Magellan#init
     * @param {Object} element - jQuery object to add the trigger to.
     * @param {Object} options - Overrides to the default plugin settings.
     */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, Magellan.defaults, this.$element.data(), options);

      this._init();
      this.calcPoints();

      Foundation.registerPlugin(this, 'Magellan');
    }

    /**
     * Initializes the Magellan plugin and calls functions to get equalizer functioning on load.
     * @private
     */
    _init() {
      var id = this.$element[0].id || Foundation.GetYoDigits(6, 'magellan');
      var _this = this;
      this.$targets = $('[data-magellan-target]');
      this.$links = this.$element.find('a');
      this.$element.attr({
        'data-resize': id,
        'data-scroll': id,
        'id': id
      });
      this.$active = $();
      this.scrollPos = parseInt(window.pageYOffset, 10);

      this._events();
    }

    /**
     * Calculates an array of pixel values that are the demarcation lines between locations on the page.
     * Can be invoked if new elements are added or the size of a location changes.
     * @function
     */
    calcPoints() {
      var _this = this,
          body = document.body,
          html = document.documentElement;

      this.points = [];
      this.winHeight = Math.round(Math.max(window.innerHeight, html.clientHeight));
      this.docHeight = Math.round(Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight));

      this.$targets.each(function () {
        var $tar = $(this),
            pt = Math.round($tar.offset().top - _this.options.threshold);
        $tar.targetPoint = pt;
        _this.points.push(pt);
      });
    }

    /**
     * Initializes events for Magellan.
     * @private
     */
    _events() {
      var _this = this,
          $body = $('html, body'),
          opts = {
        duration: _this.options.animationDuration,
        easing: _this.options.animationEasing
      };
      $(window).one('load', function () {
        if (_this.options.deepLinking) {
          if (location.hash) {
            _this.scrollToLoc(location.hash);
          }
        }
        _this.calcPoints();
        _this._updateActive();
      });

      this.$element.on({
        'resizeme.zf.trigger': this.reflow.bind(this),
        'scrollme.zf.trigger': this._updateActive.bind(this)
      }).on('click.zf.magellan', 'a[href^="#"]', function (e) {
        e.preventDefault();
        var arrival = this.getAttribute('href');
        _this.scrollToLoc(arrival);
      });
      $(window).on('popstate', function (e) {
        if (_this.options.deepLinking) {
          _this.scrollToLoc(window.location.hash);
        }
      });
    }

    /**
     * Function to scroll to a given location on the page.
     * @param {String} loc - a properly formatted jQuery id selector. Example: '#foo'
     * @function
     */
    scrollToLoc(loc) {
      // Do nothing if target does not exist to prevent errors
      if (!$(loc).length) {
        return false;
      }
      this._inTransition = true;
      var _this = this,
          scrollPos = Math.round($(loc).offset().top - this.options.threshold / 2 - this.options.barOffset);

      $('html, body').stop(true).animate({ scrollTop: scrollPos }, this.options.animationDuration, this.options.animationEasing, function () {
        _this._inTransition = false;_this._updateActive();
      });
    }

    /**
     * Calls necessary functions to update Magellan upon DOM change
     * @function
     */
    reflow() {
      this.calcPoints();
      this._updateActive();
    }

    /**
     * Updates the visibility of an active location link, and updates the url hash for the page, if deepLinking enabled.
     * @private
     * @function
     * @fires Magellan#update
     */
    _updateActive() /*evt, elem, scrollPos*/{
      if (this._inTransition) {
        return;
      }
      var winPos = /*scrollPos ||*/parseInt(window.pageYOffset, 10),
          curIdx;

      if (winPos + this.winHeight === this.docHeight) {
        curIdx = this.points.length - 1;
      } else if (winPos < this.points[0]) {
        curIdx = undefined;
      } else {
        var isDown = this.scrollPos < winPos,
            _this = this,
            curVisible = this.points.filter(function (p, i) {
          return isDown ? p - _this.options.barOffset <= winPos : p - _this.options.barOffset - _this.options.threshold <= winPos;
        });
        curIdx = curVisible.length ? curVisible.length - 1 : 0;
      }

      this.$active.removeClass(this.options.activeClass);
      this.$active = this.$links.filter('[href="#' + this.$targets.eq(curIdx).data('magellan-target') + '"]').addClass(this.options.activeClass);

      if (this.options.deepLinking) {
        var hash = "";
        if (curIdx != undefined) {
          hash = this.$active[0].getAttribute('href');
        }
        if (hash !== window.location.hash) {
          if (window.history.pushState) {
            window.history.pushState(null, null, hash);
          } else {
            window.location.hash = hash;
          }
        }
      }

      this.scrollPos = winPos;
      /**
       * Fires when magellan is finished updating to the new active element.
       * @event Magellan#update
       */
      this.$element.trigger('update.zf.magellan', [this.$active]);
    }

    /**
     * Destroys an instance of Magellan and resets the url of the window.
     * @function
     */
    destroy() {
      this.$element.off('.zf.trigger .zf.magellan').find(`.${this.options.activeClass}`).removeClass(this.options.activeClass);

      if (this.options.deepLinking) {
        var hash = this.$active[0].getAttribute('href');
        window.location.hash.replace(hash, '');
      }

      Foundation.unregisterPlugin(this);
    }
  }

  /**
   * Default settings for plugin
   */
  Magellan.defaults = {
    /**
     * Amount of time, in ms, the animated scrolling should take between locations.
     * @option
     * @example 500
     */
    animationDuration: 500,
    /**
     * Animation style to use when scrolling between locations.
     * @option
     * @example 'ease-in-out'
     */
    animationEasing: 'linear',
    /**
     * Number of pixels to use as a marker for location changes.
     * @option
     * @example 50
     */
    threshold: 50,
    /**
     * Class applied to the active locations link on the magellan container.
     * @option
     * @example 'active'
     */
    activeClass: 'active',
    /**
     * Allows the script to manipulate the url of the current page, and if supported, alter the history.
     * @option
     * @example true
     */
    deepLinking: false,
    /**
     * Number of pixels to offset the scroll of the page on item click if using a sticky nav bar.
     * @option
     * @example 25
     */
    barOffset: 0
  };

  // Window exports
  Foundation.plugin(Magellan, 'Magellan');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * OffCanvas module.
   * @module foundation.offcanvas
   * @requires foundation.util.mediaQuery
   * @requires foundation.util.triggers
   * @requires foundation.util.motion
   */

  class OffCanvas {
    /**
     * Creates a new instance of an off-canvas wrapper.
     * @class
     * @fires OffCanvas#init
     * @param {Object} element - jQuery object to initialize.
     * @param {Object} options - Overrides to the default plugin settings.
     */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, OffCanvas.defaults, this.$element.data(), options);
      this.$lastTrigger = $();
      this.$triggers = $();

      this._init();
      this._events();

      Foundation.registerPlugin(this, 'OffCanvas');
      Foundation.Keyboard.register('OffCanvas', {
        'ESCAPE': 'close'
      });
    }

    /**
     * Initializes the off-canvas wrapper by adding the exit overlay (if needed).
     * @function
     * @private
     */
    _init() {
      var id = this.$element.attr('id');

      this.$element.attr('aria-hidden', 'true');

      this.$element.addClass(`is-transition-${this.options.transition}`);

      // Find triggers that affect this element and add aria-expanded to them
      this.$triggers = $(document).find('[data-open="' + id + '"], [data-close="' + id + '"], [data-toggle="' + id + '"]').attr('aria-expanded', 'false').attr('aria-controls', id);

      // Add an overlay over the content if necessary
      if (this.options.contentOverlay === true) {
        var overlay = document.createElement('div');
        var overlayPosition = $(this.$element).css("position") === 'fixed' ? 'is-overlay-fixed' : 'is-overlay-absolute';
        overlay.setAttribute('class', 'js-off-canvas-overlay ' + overlayPosition);
        this.$overlay = $(overlay);
        if (overlayPosition === 'is-overlay-fixed') {
          $('body').append(this.$overlay);
        } else {
          this.$element.siblings('[data-off-canvas-content]').append(this.$overlay);
        }
      }

      this.options.isRevealed = this.options.isRevealed || new RegExp(this.options.revealClass, 'g').test(this.$element[0].className);

      if (this.options.isRevealed === true) {
        this.options.revealOn = this.options.revealOn || this.$element[0].className.match(/(reveal-for-medium|reveal-for-large)/g)[0].split('-')[2];
        this._setMQChecker();
      }
      if (!this.options.transitionTime === true) {
        this.options.transitionTime = parseFloat(window.getComputedStyle($('[data-off-canvas]')[0]).transitionDuration) * 1000;
      }
    }

    /**
     * Adds event handlers to the off-canvas wrapper and the exit overlay.
     * @function
     * @private
     */
    _events() {
      this.$element.off('.zf.trigger .zf.offcanvas').on({
        'open.zf.trigger': this.open.bind(this),
        'close.zf.trigger': this.close.bind(this),
        'toggle.zf.trigger': this.toggle.bind(this),
        'keydown.zf.offcanvas': this._handleKeyboard.bind(this)
      });

      if (this.options.closeOnClick === true) {
        var $target = this.options.contentOverlay ? this.$overlay : $('[data-off-canvas-content]');
        $target.on({ 'click.zf.offcanvas': this.close.bind(this) });
      }
    }

    /**
     * Applies event listener for elements that will reveal at certain breakpoints.
     * @private
     */
    _setMQChecker() {
      var _this = this;

      $(window).on('changed.zf.mediaquery', function () {
        if (Foundation.MediaQuery.atLeast(_this.options.revealOn)) {
          _this.reveal(true);
        } else {
          _this.reveal(false);
        }
      }).one('load.zf.offcanvas', function () {
        if (Foundation.MediaQuery.atLeast(_this.options.revealOn)) {
          _this.reveal(true);
        }
      });
    }

    /**
     * Handles the revealing/hiding the off-canvas at breakpoints, not the same as open.
     * @param {Boolean} isRevealed - true if element should be revealed.
     * @function
     */
    reveal(isRevealed) {
      var $closer = this.$element.find('[data-close]');
      if (isRevealed) {
        this.close();
        this.isRevealed = true;
        this.$element.attr('aria-hidden', 'false');
        this.$element.off('open.zf.trigger toggle.zf.trigger');
        if ($closer.length) {
          $closer.hide();
        }
      } else {
        this.isRevealed = false;
        this.$element.attr('aria-hidden', 'true');
        this.$element.on({
          'open.zf.trigger': this.open.bind(this),
          'toggle.zf.trigger': this.toggle.bind(this)
        });
        if ($closer.length) {
          $closer.show();
        }
      }
    }

    /**
     * Stops scrolling of the body when offcanvas is open on mobile Safari and other troublesome browsers.
     * @private
     */
    _stopScrolling(event) {
      return false;
    }

    /**
     * Opens the off-canvas menu.
     * @function
     * @param {Object} event - Event object passed from listener.
     * @param {jQuery} trigger - element that triggered the off-canvas to open.
     * @fires OffCanvas#opened
     */
    open(event, trigger) {
      if (this.$element.hasClass('is-open') || this.isRevealed) {
        return;
      }
      var _this = this;

      if (trigger) {
        this.$lastTrigger = trigger;
      }

      if (this.options.forceTo === 'top') {
        window.scrollTo(0, 0);
      } else if (this.options.forceTo === 'bottom') {
        window.scrollTo(0, document.body.scrollHeight);
      }

      /**
       * Fires when the off-canvas menu opens.
       * @event OffCanvas#opened
       */
      _this.$element.addClass('is-open');

      this.$triggers.attr('aria-expanded', 'true');
      this.$element.attr('aria-hidden', 'false').trigger('opened.zf.offcanvas');

      // If `contentScroll` is set to false, add class and disable scrolling on touch devices.
      if (this.options.contentScroll === false) {
        $('body').addClass('is-off-canvas-open').on('touchmove', this._stopScrolling);
      }

      if (this.options.contentOverlay === true) {
        this.$overlay.addClass('is-visible');
      }

      if (this.options.closeOnClick === true && this.options.contentOverlay === true) {
        this.$overlay.addClass('is-closable');
      }

      if (this.options.autoFocus === true) {
        this.$element.one(Foundation.transitionend(this.$element), function () {
          _this.$element.find('a, button').eq(0).focus();
        });
      }

      if (this.options.trapFocus === true) {
        this.$element.siblings('[data-off-canvas-content]').attr('tabindex', '-1');
        Foundation.Keyboard.trapFocus(this.$element);
      }
    }

    /**
     * Closes the off-canvas menu.
     * @function
     * @param {Function} cb - optional cb to fire after closure.
     * @fires OffCanvas#closed
     */
    close(cb) {
      if (!this.$element.hasClass('is-open') || this.isRevealed) {
        return;
      }

      var _this = this;

      _this.$element.removeClass('is-open');

      this.$element.attr('aria-hidden', 'true')
      /**
       * Fires when the off-canvas menu opens.
       * @event OffCanvas#closed
       */
      .trigger('closed.zf.offcanvas');

      // If `contentScroll` is set to false, remove class and re-enable scrolling on touch devices.
      if (this.options.contentScroll === false) {
        $('body').removeClass('is-off-canvas-open').off('touchmove', this._stopScrolling);
      }

      if (this.options.contentOverlay === true) {
        this.$overlay.removeClass('is-visible');
      }

      if (this.options.closeOnClick === true && this.options.contentOverlay === true) {
        this.$overlay.removeClass('is-closable');
      }

      this.$triggers.attr('aria-expanded', 'false');

      if (this.options.trapFocus === true) {
        this.$element.siblings('[data-off-canvas-content]').removeAttr('tabindex');
        Foundation.Keyboard.releaseFocus(this.$element);
      }
    }

    /**
     * Toggles the off-canvas menu open or closed.
     * @function
     * @param {Object} event - Event object passed from listener.
     * @param {jQuery} trigger - element that triggered the off-canvas to open.
     */
    toggle(event, trigger) {
      if (this.$element.hasClass('is-open')) {
        this.close(event, trigger);
      } else {
        this.open(event, trigger);
      }
    }

    /**
     * Handles keyboard input when detected. When the escape key is pressed, the off-canvas menu closes, and focus is restored to the element that opened the menu.
     * @function
     * @private
     */
    _handleKeyboard(e) {
      Foundation.Keyboard.handleKey(e, 'OffCanvas', {
        close: () => {
          this.close();
          this.$lastTrigger.focus();
          return true;
        },
        handled: () => {
          e.stopPropagation();
          e.preventDefault();
        }
      });
    }

    /**
     * Destroys the offcanvas plugin.
     * @function
     */
    destroy() {
      this.close();
      this.$element.off('.zf.trigger .zf.offcanvas');
      this.$overlay.off('.zf.offcanvas');

      Foundation.unregisterPlugin(this);
    }
  }

  OffCanvas.defaults = {
    /**
     * Allow the user to click outside of the menu to close it.
     * @option
     * @example true
     */
    closeOnClick: true,

    /**
     * Adds an overlay on top of `[data-off-canvas-content]`.
     * @option
     * @example true
     */
    contentOverlay: true,

    /**
     * Enable/disable scrolling of the main content when an off canvas panel is open.
     * @option
     * @example true
     */
    contentScroll: true,

    /**
     * Amount of time in ms the open and close transition requires. If none selected, pulls from body style.
     * @option
     * @example 500
     */
    transitionTime: 0,

    /**
     * Type of transition for the offcanvas menu. Options are 'push', 'detached' or 'slide'.
     * @option
     * @example push
     */
    transition: 'push',

    /**
     * Force the page to scroll to top or bottom on open.
     * @option
     * @example top
     */
    forceTo: null,

    /**
     * Allow the offcanvas to remain open for certain breakpoints.
     * @option
     * @example false
     */
    isRevealed: false,

    /**
     * Breakpoint at which to reveal. JS will use a RegExp to target standard classes, if changing classnames, pass your class with the `revealClass` option.
     * @option
     * @example reveal-for-large
     */
    revealOn: null,

    /**
     * Force focus to the offcanvas on open. If true, will focus the opening trigger on close.
     * @option
     * @example true
     */
    autoFocus: true,

    /**
     * Class used to force an offcanvas to remain open. Foundation defaults for this are `reveal-for-large` & `reveal-for-medium`.
     * @option
     * TODO improve the regex testing for this.
     * @example reveal-for-large
     */
    revealClass: 'reveal-for-',

    /**
     * Triggers optional focus trapping when opening an offcanvas. Sets tabindex of [data-off-canvas-content] to -1 for accessibility purposes.
     * @option
     * @example true
     */
    trapFocus: false
  };

  // Window exports
  Foundation.plugin(OffCanvas, 'OffCanvas');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * Orbit module.
   * @module foundation.orbit
   * @requires foundation.util.keyboard
   * @requires foundation.util.motion
   * @requires foundation.util.timerAndImageLoader
   * @requires foundation.util.touch
   */

  class Orbit {
    /**
    * Creates a new instance of an orbit carousel.
    * @class
    * @param {jQuery} element - jQuery object to make into an Orbit Carousel.
    * @param {Object} options - Overrides to the default plugin settings.
    */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, Orbit.defaults, this.$element.data(), options);

      this._init();

      Foundation.registerPlugin(this, 'Orbit');
      Foundation.Keyboard.register('Orbit', {
        'ltr': {
          'ARROW_RIGHT': 'next',
          'ARROW_LEFT': 'previous'
        },
        'rtl': {
          'ARROW_LEFT': 'next',
          'ARROW_RIGHT': 'previous'
        }
      });
    }

    /**
    * Initializes the plugin by creating jQuery collections, setting attributes, and starting the animation.
    * @function
    * @private
    */
    _init() {
      // @TODO: consider discussion on PR #9278 about DOM pollution by changeSlide
      this._reset();

      this.$wrapper = this.$element.find(`.${this.options.containerClass}`);
      this.$slides = this.$element.find(`.${this.options.slideClass}`);

      var $images = this.$element.find('img'),
          initActive = this.$slides.filter('.is-active'),
          id = this.$element[0].id || Foundation.GetYoDigits(6, 'orbit');

      this.$element.attr({
        'data-resize': id,
        'id': id
      });

      if (!initActive.length) {
        this.$slides.eq(0).addClass('is-active');
      }

      if (!this.options.useMUI) {
        this.$slides.addClass('no-motionui');
      }

      if ($images.length) {
        Foundation.onImagesLoaded($images, this._prepareForOrbit.bind(this));
      } else {
        this._prepareForOrbit(); //hehe
      }

      if (this.options.bullets) {
        this._loadBullets();
      }

      this._events();

      if (this.options.autoPlay && this.$slides.length > 1) {
        this.geoSync();
      }

      if (this.options.accessible) {
        // allow wrapper to be focusable to enable arrow navigation
        this.$wrapper.attr('tabindex', 0);
      }
    }

    /**
    * Creates a jQuery collection of bullets, if they are being used.
    * @function
    * @private
    */
    _loadBullets() {
      this.$bullets = this.$element.find(`.${this.options.boxOfBullets}`).find('button');
    }

    /**
    * Sets a `timer` object on the orbit, and starts the counter for the next slide.
    * @function
    */
    geoSync() {
      var _this = this;
      this.timer = new Foundation.Timer(this.$element, {
        duration: this.options.timerDelay,
        infinite: false
      }, function () {
        _this.changeSlide(true);
      });
      this.timer.start();
    }

    /**
    * Sets wrapper and slide heights for the orbit.
    * @function
    * @private
    */
    _prepareForOrbit() {
      var _this = this;
      this._setWrapperHeight();
    }

    /**
    * Calulates the height of each slide in the collection, and uses the tallest one for the wrapper height.
    * @function
    * @private
    * @param {Function} cb - a callback function to fire when complete.
    */
    _setWrapperHeight(cb) {
      //rewrite this to `for` loop
      var max = 0,
          temp,
          counter = 0,
          _this = this;

      this.$slides.each(function () {
        temp = this.getBoundingClientRect().height;
        $(this).attr('data-slide', counter);

        if (_this.$slides.filter('.is-active')[0] !== _this.$slides.eq(counter)[0]) {
          //if not the active slide, set css position and display property
          $(this).css({ 'position': 'relative', 'display': 'none' });
        }
        max = temp > max ? temp : max;
        counter++;
      });

      if (counter === this.$slides.length) {
        this.$wrapper.css({ 'height': max }); //only change the wrapper height property once.
        if (cb) {
          cb(max);
        } //fire callback with max height dimension.
      }
    }

    /**
    * Sets the max-height of each slide.
    * @function
    * @private
    */
    _setSlideHeight(height) {
      this.$slides.each(function () {
        $(this).css('max-height', height);
      });
    }

    /**
    * Adds event listeners to basically everything within the element.
    * @function
    * @private
    */
    _events() {
      var _this = this;

      //***************************************
      //**Now using custom event - thanks to:**
      //**      Yohai Ararat of Toronto      **
      //***************************************
      //
      this.$element.off('.resizeme.zf.trigger').on({
        'resizeme.zf.trigger': this._prepareForOrbit.bind(this)
      });
      if (this.$slides.length > 1) {

        if (this.options.swipe) {
          this.$slides.off('swipeleft.zf.orbit swiperight.zf.orbit').on('swipeleft.zf.orbit', function (e) {
            e.preventDefault();
            _this.changeSlide(true);
          }).on('swiperight.zf.orbit', function (e) {
            e.preventDefault();
            _this.changeSlide(false);
          });
        }
        //***************************************

        if (this.options.autoPlay) {
          this.$slides.on('click.zf.orbit', function () {
            _this.$element.data('clickedOn', _this.$element.data('clickedOn') ? false : true);
            _this.timer[_this.$element.data('clickedOn') ? 'pause' : 'start']();
          });

          if (this.options.pauseOnHover) {
            this.$element.on('mouseenter.zf.orbit', function () {
              _this.timer.pause();
            }).on('mouseleave.zf.orbit', function () {
              if (!_this.$element.data('clickedOn')) {
                _this.timer.start();
              }
            });
          }
        }

        if (this.options.navButtons) {
          var $controls = this.$element.find(`.${this.options.nextClass}, .${this.options.prevClass}`);
          $controls.attr('tabindex', 0)
          //also need to handle enter/return and spacebar key presses
          .on('click.zf.orbit touchend.zf.orbit', function (e) {
            e.preventDefault();
            _this.changeSlide($(this).hasClass(_this.options.nextClass));
          });
        }

        if (this.options.bullets) {
          this.$bullets.on('click.zf.orbit touchend.zf.orbit', function () {
            if (/is-active/g.test(this.className)) {
              return false;
            } //if this is active, kick out of function.
            var idx = $(this).data('slide'),
                ltr = idx > _this.$slides.filter('.is-active').data('slide'),
                $slide = _this.$slides.eq(idx);

            _this.changeSlide(ltr, $slide, idx);
          });
        }

        if (this.options.accessible) {
          this.$wrapper.add(this.$bullets).on('keydown.zf.orbit', function (e) {
            // handle keyboard event with keyboard util
            Foundation.Keyboard.handleKey(e, 'Orbit', {
              next: function () {
                _this.changeSlide(true);
              },
              previous: function () {
                _this.changeSlide(false);
              },
              handled: function () {
                // if bullet is focused, make sure focus moves
                if ($(e.target).is(_this.$bullets)) {
                  _this.$bullets.filter('.is-active').focus();
                }
              }
            });
          });
        }
      }
    }

    /**
     * Resets Orbit so it can be reinitialized
     */
    _reset() {
      // Don't do anything if there are no slides (first run)
      if (typeof this.$slides == 'undefined') {
        return;
      }

      if (this.$slides.length > 1) {
        // Remove old events
        this.$element.off('.zf.orbit').find('*').off('.zf.orbit');

        // Restart timer if autoPlay is enabled
        if (this.options.autoPlay) {
          this.timer.restart();
        }

        // Reset all sliddes
        this.$slides.each(function (el) {
          $(el).removeClass('is-active is-active is-in').removeAttr('aria-live').hide();
        });

        // Show the first slide
        this.$slides.first().addClass('is-active').show();

        // Triggers when the slide has finished animating
        this.$element.trigger('slidechange.zf.orbit', [this.$slides.first()]);

        // Select first bullet if bullets are present
        if (this.options.bullets) {
          this._updateBullets(0);
        }
      }
    }

    /**
    * Changes the current slide to a new one.
    * @function
    * @param {Boolean} isLTR - flag if the slide should move left to right.
    * @param {jQuery} chosenSlide - the jQuery element of the slide to show next, if one is selected.
    * @param {Number} idx - the index of the new slide in its collection, if one chosen.
    * @fires Orbit#slidechange
    */
    changeSlide(isLTR, chosenSlide, idx) {
      if (!this.$slides) {
        return;
      } // Don't freak out if we're in the middle of cleanup
      var $curSlide = this.$slides.filter('.is-active').eq(0);

      if (/mui/g.test($curSlide[0].className)) {
        return false;
      } //if the slide is currently animating, kick out of the function

      var $firstSlide = this.$slides.first(),
          $lastSlide = this.$slides.last(),
          dirIn = isLTR ? 'Right' : 'Left',
          dirOut = isLTR ? 'Left' : 'Right',
          _this = this,
          $newSlide;

      if (!chosenSlide) {
        //most of the time, this will be auto played or clicked from the navButtons.
        $newSlide = isLTR ? //if wrapping enabled, check to see if there is a `next` or `prev` sibling, if not, select the first or last slide to fill in. if wrapping not enabled, attempt to select `next` or `prev`, if there's nothing there, the function will kick out on next step. CRAZY NESTED TERNARIES!!!!!
        this.options.infiniteWrap ? $curSlide.next(`.${this.options.slideClass}`).length ? $curSlide.next(`.${this.options.slideClass}`) : $firstSlide : $curSlide.next(`.${this.options.slideClass}`) : //pick next slide if moving left to right
        this.options.infiniteWrap ? $curSlide.prev(`.${this.options.slideClass}`).length ? $curSlide.prev(`.${this.options.slideClass}`) : $lastSlide : $curSlide.prev(`.${this.options.slideClass}`); //pick prev slide if moving right to left
      } else {
        $newSlide = chosenSlide;
      }

      if ($newSlide.length) {
        /**
        * Triggers before the next slide starts animating in and only if a next slide has been found.
        * @event Orbit#beforeslidechange
        */
        this.$element.trigger('beforeslidechange.zf.orbit', [$curSlide, $newSlide]);

        if (this.options.bullets) {
          idx = idx || this.$slides.index($newSlide); //grab index to update bullets
          this._updateBullets(idx);
        }

        if (this.options.useMUI && !this.$element.is(':hidden')) {
          Foundation.Motion.animateIn($newSlide.addClass('is-active').css({ 'position': 'absolute', 'top': 0 }), this.options[`animInFrom${dirIn}`], function () {
            $newSlide.css({ 'position': 'relative', 'display': 'block' }).attr('aria-live', 'polite');
          });

          Foundation.Motion.animateOut($curSlide.removeClass('is-active'), this.options[`animOutTo${dirOut}`], function () {
            $curSlide.removeAttr('aria-live');
            if (_this.options.autoPlay && !_this.timer.isPaused) {
              _this.timer.restart();
            }
            //do stuff?
          });
        } else {
          $curSlide.removeClass('is-active is-in').removeAttr('aria-live').hide();
          $newSlide.addClass('is-active is-in').attr('aria-live', 'polite').show();
          if (this.options.autoPlay && !this.timer.isPaused) {
            this.timer.restart();
          }
        }
        /**
        * Triggers when the slide has finished animating in.
        * @event Orbit#slidechange
        */
        this.$element.trigger('slidechange.zf.orbit', [$newSlide]);
      }
    }

    /**
    * Updates the active state of the bullets, if displayed.
    * @function
    * @private
    * @param {Number} idx - the index of the current slide.
    */
    _updateBullets(idx) {
      var $oldBullet = this.$element.find(`.${this.options.boxOfBullets}`).find('.is-active').removeClass('is-active').blur(),
          span = $oldBullet.find('span:last').detach(),
          $newBullet = this.$bullets.eq(idx).addClass('is-active').append(span);
    }

    /**
    * Destroys the carousel and hides the element.
    * @function
    */
    destroy() {
      this.$element.off('.zf.orbit').find('*').off('.zf.orbit').end().hide();
      Foundation.unregisterPlugin(this);
    }
  }

  Orbit.defaults = {
    /**
    * Tells the JS to look for and loadBullets.
    * @option
    * @example true
    */
    bullets: true,
    /**
    * Tells the JS to apply event listeners to nav buttons
    * @option
    * @example true
    */
    navButtons: true,
    /**
    * motion-ui animation class to apply
    * @option
    * @example 'slide-in-right'
    */
    animInFromRight: 'slide-in-right',
    /**
    * motion-ui animation class to apply
    * @option
    * @example 'slide-out-right'
    */
    animOutToRight: 'slide-out-right',
    /**
    * motion-ui animation class to apply
    * @option
    * @example 'slide-in-left'
    *
    */
    animInFromLeft: 'slide-in-left',
    /**
    * motion-ui animation class to apply
    * @option
    * @example 'slide-out-left'
    */
    animOutToLeft: 'slide-out-left',
    /**
    * Allows Orbit to automatically animate on page load.
    * @option
    * @example true
    */
    autoPlay: true,
    /**
    * Amount of time, in ms, between slide transitions
    * @option
    * @example 5000
    */
    timerDelay: 5000,
    /**
    * Allows Orbit to infinitely loop through the slides
    * @option
    * @example true
    */
    infiniteWrap: true,
    /**
    * Allows the Orbit slides to bind to swipe events for mobile, requires an additional util library
    * @option
    * @example true
    */
    swipe: true,
    /**
    * Allows the timing function to pause animation on hover.
    * @option
    * @example true
    */
    pauseOnHover: true,
    /**
    * Allows Orbit to bind keyboard events to the slider, to animate frames with arrow keys
    * @option
    * @example true
    */
    accessible: true,
    /**
    * Class applied to the container of Orbit
    * @option
    * @example 'orbit-container'
    */
    containerClass: 'orbit-container',
    /**
    * Class applied to individual slides.
    * @option
    * @example 'orbit-slide'
    */
    slideClass: 'orbit-slide',
    /**
    * Class applied to the bullet container. You're welcome.
    * @option
    * @example 'orbit-bullets'
    */
    boxOfBullets: 'orbit-bullets',
    /**
    * Class applied to the `next` navigation button.
    * @option
    * @example 'orbit-next'
    */
    nextClass: 'orbit-next',
    /**
    * Class applied to the `previous` navigation button.
    * @option
    * @example 'orbit-previous'
    */
    prevClass: 'orbit-previous',
    /**
    * Boolean to flag the js to use motion ui classes or not. Default to true for backwards compatability.
    * @option
    * @example true
    */
    useMUI: true
  };

  // Window exports
  Foundation.plugin(Orbit, 'Orbit');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * ResponsiveMenu module.
   * @module foundation.responsiveMenu
   * @requires foundation.util.triggers
   * @requires foundation.util.mediaQuery
   * @requires foundation.util.accordionMenu
   * @requires foundation.util.drilldown
   * @requires foundation.util.dropdown-menu
   */

  class ResponsiveMenu {
    /**
     * Creates a new instance of a responsive menu.
     * @class
     * @fires ResponsiveMenu#init
     * @param {jQuery} element - jQuery object to make into a dropdown menu.
     * @param {Object} options - Overrides to the default plugin settings.
     */
    constructor(element, options) {
      this.$element = $(element);
      this.rules = this.$element.data('responsive-menu');
      this.currentMq = null;
      this.currentPlugin = null;

      this._init();
      this._events();

      Foundation.registerPlugin(this, 'ResponsiveMenu');
    }

    /**
     * Initializes the Menu by parsing the classes from the 'data-ResponsiveMenu' attribute on the element.
     * @function
     * @private
     */
    _init() {
      // The first time an Interchange plugin is initialized, this.rules is converted from a string of "classes" to an object of rules
      if (typeof this.rules === 'string') {
        let rulesTree = {};

        // Parse rules from "classes" pulled from data attribute
        let rules = this.rules.split(' ');

        // Iterate through every rule found
        for (let i = 0; i < rules.length; i++) {
          let rule = rules[i].split('-');
          let ruleSize = rule.length > 1 ? rule[0] : 'small';
          let rulePlugin = rule.length > 1 ? rule[1] : rule[0];

          if (MenuPlugins[rulePlugin] !== null) {
            rulesTree[ruleSize] = MenuPlugins[rulePlugin];
          }
        }

        this.rules = rulesTree;
      }

      if (!$.isEmptyObject(this.rules)) {
        this._checkMediaQueries();
      }
      // Add data-mutate since children may need it.
      this.$element.attr('data-mutate', this.$element.attr('data-mutate') || Foundation.GetYoDigits(6, 'responsive-menu'));
    }

    /**
     * Initializes events for the Menu.
     * @function
     * @private
     */
    _events() {
      var _this = this;

      $(window).on('changed.zf.mediaquery', function () {
        _this._checkMediaQueries();
      });
      // $(window).on('resize.zf.ResponsiveMenu', function() {
      //   _this._checkMediaQueries();
      // });
    }

    /**
     * Checks the current screen width against available media queries. If the media query has changed, and the plugin needed has changed, the plugins will swap out.
     * @function
     * @private
     */
    _checkMediaQueries() {
      var matchedMq,
          _this = this;
      // Iterate through each rule and find the last matching rule
      $.each(this.rules, function (key) {
        if (Foundation.MediaQuery.atLeast(key)) {
          matchedMq = key;
        }
      });

      // No match? No dice
      if (!matchedMq) return;

      // Plugin already initialized? We good
      if (this.currentPlugin instanceof this.rules[matchedMq].plugin) return;

      // Remove existing plugin-specific CSS classes
      $.each(MenuPlugins, function (key, value) {
        _this.$element.removeClass(value.cssClass);
      });

      // Add the CSS class for the new plugin
      this.$element.addClass(this.rules[matchedMq].cssClass);

      // Create an instance of the new plugin
      if (this.currentPlugin) this.currentPlugin.destroy();
      this.currentPlugin = new this.rules[matchedMq].plugin(this.$element, {});
    }

    /**
     * Destroys the instance of the current plugin on this element, as well as the window resize handler that switches the plugins out.
     * @function
     */
    destroy() {
      this.currentPlugin.destroy();
      $(window).off('.zf.ResponsiveMenu');
      Foundation.unregisterPlugin(this);
    }
  }

  ResponsiveMenu.defaults = {};

  // The plugin matches the plugin classes with these plugin instances.
  var MenuPlugins = {
    dropdown: {
      cssClass: 'dropdown',
      plugin: Foundation._plugins['dropdown-menu'] || null
    },
    drilldown: {
      cssClass: 'drilldown',
      plugin: Foundation._plugins['drilldown'] || null
    },
    accordion: {
      cssClass: 'accordion-menu',
      plugin: Foundation._plugins['accordion-menu'] || null
    }
  };

  // Window exports
  Foundation.plugin(ResponsiveMenu, 'ResponsiveMenu');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * ResponsiveToggle module.
   * @module foundation.responsiveToggle
   * @requires foundation.util.mediaQuery
   */

  class ResponsiveToggle {
    /**
     * Creates a new instance of Tab Bar.
     * @class
     * @fires ResponsiveToggle#init
     * @param {jQuery} element - jQuery object to attach tab bar functionality to.
     * @param {Object} options - Overrides to the default plugin settings.
     */
    constructor(element, options) {
      this.$element = $(element);
      this.options = $.extend({}, ResponsiveToggle.defaults, this.$element.data(), options);

      this._init();
      this._events();

      Foundation.registerPlugin(this, 'ResponsiveToggle');
    }

    /**
     * Initializes the tab bar by finding the target element, toggling element, and running update().
     * @function
     * @private
     */
    _init() {
      var targetID = this.$element.data('responsive-toggle');
      if (!targetID) {
        console.error('Your tab bar needs an ID of a Menu as the value of data-tab-bar.');
      }

      this.$targetMenu = $(`#${targetID}`);
      this.$toggler = this.$element.find('[data-toggle]');
      this.options = $.extend({}, this.options, this.$targetMenu.data());

      // If they were set, parse the animation classes
      if (this.options.animate) {
        let input = this.options.animate.split(' ');

        this.animationIn = input[0];
        this.animationOut = input[1] || null;
      }

      this._update();
    }

    /**
     * Adds necessary event handlers for the tab bar to work.
     * @function
     * @private
     */
    _events() {
      var _this = this;

      this._updateMqHandler = this._update.bind(this);

      $(window).on('changed.zf.mediaquery', this._updateMqHandler);

      this.$toggler.on('click.zf.responsiveToggle', this.toggleMenu.bind(this));
    }

    /**
     * Checks the current media query to determine if the tab bar should be visible or hidden.
     * @function
     * @private
     */
    _update() {
      // Mobile
      if (!Foundation.MediaQuery.atLeast(this.options.hideFor)) {
        this.$element.show();
        this.$targetMenu.hide();
      }

      // Desktop
      else {
          this.$element.hide();
          this.$targetMenu.show();
        }
    }

    /**
     * Toggles the element attached to the tab bar. The toggle only happens if the screen is small enough to allow it.
     * @function
     * @fires ResponsiveToggle#toggled
     */
    toggleMenu() {
      if (!Foundation.MediaQuery.atLeast(this.options.hideFor)) {
        if (this.options.animate) {
          if (this.$targetMenu.is(':hidden')) {
            Foundation.Motion.animateIn(this.$targetMenu, this.animationIn, () => {
              /**
               * Fires when the element attached to the tab bar toggles.
               * @event ResponsiveToggle#toggled
               */
              this.$element.trigger('toggled.zf.responsiveToggle');
              this.$targetMenu.find('[data-mutate]').triggerHandler('mutateme.zf.trigger');
            });
          } else {
            Foundation.Motion.animateOut(this.$targetMenu, this.animationOut, () => {
              /**
               * Fires when the element attached to the tab bar toggles.
               * @event ResponsiveToggle#toggled
               */
              this.$element.trigger('toggled.zf.responsiveToggle');
            });
          }
        } else {
          this.$targetMenu.toggle(0);
          this.$targetMenu.find('[data-mutate]').trigger('mutateme.zf.trigger');

          /**
           * Fires when the element attached to the tab bar toggles.
           * @event ResponsiveToggle#toggled
           */
          this.$element.trigger('toggled.zf.responsiveToggle');
        }
      }
    }

    destroy() {
      this.$element.off('.zf.responsiveToggle');
      this.$toggler.off('.zf.responsiveToggle');

      $(window).off('changed.zf.mediaquery', this._updateMqHandler);

      Foundation.unregisterPlugin(this);
    }
  }

  ResponsiveToggle.defaults = {
    /**
     * The breakpoint after which the menu is always shown, and the tab bar is hidden.
     * @option
     * @example 'medium'
     */
    hideFor: 'medium',

    /**
     * To decide if the toggle should be animated or not.
     * @option
     * @example false
     */
    animate: false
  };

  // Window exports
  Foundation.plugin(ResponsiveToggle, 'ResponsiveToggle');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * Reveal module.
   * @module foundation.reveal
   * @requires foundation.util.keyboard
   * @requires foundation.util.box
   * @requires foundation.util.triggers
   * @requires foundation.util.mediaQuery
   * @requires foundation.util.motion if using animations
   */

  class Reveal {
    /**
     * Creates a new instance of Reveal.
     * @class
     * @param {jQuery} element - jQuery object to use for the modal.
     * @param {Object} options - optional parameters.
     */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, Reveal.defaults, this.$element.data(), options);
      this._init();

      Foundation.registerPlugin(this, 'Reveal');
      Foundation.Keyboard.register('Reveal', {
        'ENTER': 'open',
        'SPACE': 'open',
        'ESCAPE': 'close'
      });
    }

    /**
     * Initializes the modal by adding the overlay and close buttons, (if selected).
     * @private
     */
    _init() {
      this.id = this.$element.attr('id');
      this.isActive = false;
      this.cached = { mq: Foundation.MediaQuery.current };
      this.isMobile = mobileSniff();

      this.$anchor = $(`[data-open="${this.id}"]`).length ? $(`[data-open="${this.id}"]`) : $(`[data-toggle="${this.id}"]`);
      this.$anchor.attr({
        'aria-controls': this.id,
        'aria-haspopup': true,
        'tabindex': 0
      });

      if (this.options.fullScreen || this.$element.hasClass('full')) {
        this.options.fullScreen = true;
        this.options.overlay = false;
      }
      if (this.options.overlay && !this.$overlay) {
        this.$overlay = this._makeOverlay(this.id);
      }

      this.$element.attr({
        'role': 'dialog',
        'aria-hidden': true,
        'data-yeti-box': this.id,
        'data-resize': this.id
      });

      if (this.$overlay) {
        this.$element.detach().appendTo(this.$overlay);
      } else {
        this.$element.detach().appendTo($(this.options.appendTo));
        this.$element.addClass('without-overlay');
      }
      this._events();
      if (this.options.deepLink && window.location.hash === `#${this.id}`) {
        $(window).one('load.zf.reveal', this.open.bind(this));
      }
    }

    /**
     * Creates an overlay div to display behind the modal.
     * @private
     */
    _makeOverlay() {
      return $('<div></div>').addClass('reveal-overlay').appendTo(this.options.appendTo);
    }

    /**
     * Updates position of modal
     * TODO:  Figure out if we actually need to cache these values or if it doesn't matter
     * @private
     */
    _updatePosition() {
      var width = this.$element.outerWidth();
      var outerWidth = $(window).width();
      var height = this.$element.outerHeight();
      var outerHeight = $(window).height();
      var left, top;
      if (this.options.hOffset === 'auto') {
        left = parseInt((outerWidth - width) / 2, 10);
      } else {
        left = parseInt(this.options.hOffset, 10);
      }
      if (this.options.vOffset === 'auto') {
        if (height > outerHeight) {
          top = parseInt(Math.min(100, outerHeight / 10), 10);
        } else {
          top = parseInt((outerHeight - height) / 4, 10);
        }
      } else {
        top = parseInt(this.options.vOffset, 10);
      }
      this.$element.css({ top: top + 'px' });
      // only worry about left if we don't have an overlay or we havea  horizontal offset,
      // otherwise we're perfectly in the middle
      if (!this.$overlay || this.options.hOffset !== 'auto') {
        this.$element.css({ left: left + 'px' });
        this.$element.css({ margin: '0px' });
      }
    }

    /**
     * Adds event handlers for the modal.
     * @private
     */
    _events() {
      var _this = this;

      this.$element.on({
        'open.zf.trigger': this.open.bind(this),
        'close.zf.trigger': (event, $element) => {
          if (event.target === _this.$element[0] || $(event.target).parents('[data-closable]')[0] === $element) {
            // only close reveal when it's explicitly called
            return this.close.apply(this);
          }
        },
        'toggle.zf.trigger': this.toggle.bind(this),
        'resizeme.zf.trigger': function () {
          _this._updatePosition();
        }
      });

      if (this.$anchor.length) {
        this.$anchor.on('keydown.zf.reveal', function (e) {
          if (e.which === 13 || e.which === 32) {
            e.stopPropagation();
            e.preventDefault();
            _this.open();
          }
        });
      }

      if (this.options.closeOnClick && this.options.overlay) {
        this.$overlay.off('.zf.reveal').on('click.zf.reveal', function (e) {
          if (e.target === _this.$element[0] || $.contains(_this.$element[0], e.target) || !$.contains(document, e.target)) {
            return;
          }
          _this.close();
        });
      }
      if (this.options.deepLink) {
        $(window).on(`popstate.zf.reveal:${this.id}`, this._handleState.bind(this));
      }
    }

    /**
     * Handles modal methods on back/forward button clicks or any other event that triggers popstate.
     * @private
     */
    _handleState(e) {
      if (window.location.hash === '#' + this.id && !this.isActive) {
        this.open();
      } else {
        this.close();
      }
    }

    /**
     * Opens the modal controlled by `this.$anchor`, and closes all others by default.
     * @function
     * @fires Reveal#closeme
     * @fires Reveal#open
     */
    open() {
      if (this.options.deepLink) {
        var hash = `#${this.id}`;

        if (window.history.pushState) {
          window.history.pushState(null, null, hash);
        } else {
          window.location.hash = hash;
        }
      }

      this.isActive = true;

      // Make elements invisible, but remove display: none so we can get size and positioning
      this.$element.css({ 'visibility': 'hidden' }).show().scrollTop(0);
      if (this.options.overlay) {
        this.$overlay.css({ 'visibility': 'hidden' }).show();
      }

      this._updatePosition();

      this.$element.hide().css({ 'visibility': '' });

      if (this.$overlay) {
        this.$overlay.css({ 'visibility': '' }).hide();
        if (this.$element.hasClass('fast')) {
          this.$overlay.addClass('fast');
        } else if (this.$element.hasClass('slow')) {
          this.$overlay.addClass('slow');
        }
      }

      if (!this.options.multipleOpened) {
        /**
         * Fires immediately before the modal opens.
         * Closes any other modals that are currently open
         * @event Reveal#closeme
         */
        this.$element.trigger('closeme.zf.reveal', this.id);
      }

      var _this = this;

      function addRevealOpenClasses() {
        if (_this.isMobile) {
          if (!_this.originalScrollPos) {
            _this.originalScrollPos = window.pageYOffset;
          }
          $('html, body').addClass('is-reveal-open');
        } else {
          $('body').addClass('is-reveal-open');
        }
      }
      // Motion UI method of reveal
      if (this.options.animationIn) {
        function afterAnimation() {
          _this.$element.attr({
            'aria-hidden': false,
            'tabindex': -1
          }).focus();
          addRevealOpenClasses();
          Foundation.Keyboard.trapFocus(_this.$element);
        }
        if (this.options.overlay) {
          Foundation.Motion.animateIn(this.$overlay, 'fade-in');
        }
        Foundation.Motion.animateIn(this.$element, this.options.animationIn, () => {
          if (this.$element) {
            // protect against object having been removed
            this.focusableElements = Foundation.Keyboard.findFocusable(this.$element);
            afterAnimation();
          }
        });
      }
      // jQuery method of reveal
      else {
          if (this.options.overlay) {
            this.$overlay.show(0);
          }
          this.$element.show(this.options.showDelay);
        }

      // handle accessibility
      this.$element.attr({
        'aria-hidden': false,
        'tabindex': -1
      }).focus();
      Foundation.Keyboard.trapFocus(this.$element);

      /**
       * Fires when the modal has successfully opened.
       * @event Reveal#open
       */
      this.$element.trigger('open.zf.reveal');

      addRevealOpenClasses();

      setTimeout(() => {
        this._extraHandlers();
      }, 0);
    }

    /**
     * Adds extra event handlers for the body and window if necessary.
     * @private
     */
    _extraHandlers() {
      var _this = this;
      if (!this.$element) {
        return;
      } // If we're in the middle of cleanup, don't freak out
      this.focusableElements = Foundation.Keyboard.findFocusable(this.$element);

      if (!this.options.overlay && this.options.closeOnClick && !this.options.fullScreen) {
        $('body').on('click.zf.reveal', function (e) {
          if (e.target === _this.$element[0] || $.contains(_this.$element[0], e.target) || !$.contains(document, e.target)) {
            return;
          }
          _this.close();
        });
      }

      if (this.options.closeOnEsc) {
        $(window).on('keydown.zf.reveal', function (e) {
          Foundation.Keyboard.handleKey(e, 'Reveal', {
            close: function () {
              if (_this.options.closeOnEsc) {
                _this.close();
                _this.$anchor.focus();
              }
            }
          });
        });
      }

      // lock focus within modal while tabbing
      this.$element.on('keydown.zf.reveal', function (e) {
        var $target = $(this);
        // handle keyboard event with keyboard util
        Foundation.Keyboard.handleKey(e, 'Reveal', {
          open: function () {
            if (_this.$element.find(':focus').is(_this.$element.find('[data-close]'))) {
              setTimeout(function () {
                // set focus back to anchor if close button has been activated
                _this.$anchor.focus();
              }, 1);
            } else if ($target.is(_this.focusableElements)) {
              // dont't trigger if acual element has focus (i.e. inputs, links, ...)
              _this.open();
            }
          },
          close: function () {
            if (_this.options.closeOnEsc) {
              _this.close();
              _this.$anchor.focus();
            }
          },
          handled: function (preventDefault) {
            if (preventDefault) {
              e.preventDefault();
            }
          }
        });
      });
    }

    /**
     * Closes the modal.
     * @function
     * @fires Reveal#closed
     */
    close() {
      if (!this.isActive || !this.$element.is(':visible')) {
        return false;
      }
      var _this = this;

      // Motion UI method of hiding
      if (this.options.animationOut) {
        if (this.options.overlay) {
          Foundation.Motion.animateOut(this.$overlay, 'fade-out', finishUp);
        } else {
          finishUp();
        }

        Foundation.Motion.animateOut(this.$element, this.options.animationOut);
      }
      // jQuery method of hiding
      else {
          if (this.options.overlay) {
            this.$overlay.hide(0, finishUp);
          } else {
            finishUp();
          }

          this.$element.hide(this.options.hideDelay);
        }

      // Conditionals to remove extra event listeners added on open
      if (this.options.closeOnEsc) {
        $(window).off('keydown.zf.reveal');
      }

      if (!this.options.overlay && this.options.closeOnClick) {
        $('body').off('click.zf.reveal');
      }

      this.$element.off('keydown.zf.reveal');

      function finishUp() {
        if (_this.isMobile) {
          $('html, body').removeClass('is-reveal-open');
          if (_this.originalScrollPos) {
            $('body').scrollTop(_this.originalScrollPos);
            _this.originalScrollPos = null;
          }
        } else {
          $('body').removeClass('is-reveal-open');
        }

        Foundation.Keyboard.releaseFocus(_this.$element);

        _this.$element.attr('aria-hidden', true);

        /**
        * Fires when the modal is done closing.
        * @event Reveal#closed
        */
        _this.$element.trigger('closed.zf.reveal');
      }

      /**
      * Resets the modal content
      * This prevents a running video to keep going in the background
      */
      if (this.options.resetOnClose) {
        this.$element.html(this.$element.html());
      }

      this.isActive = false;
      if (_this.options.deepLink) {
        if (window.history.replaceState) {
          window.history.replaceState('', document.title, window.location.href.replace(`#${this.id}`, ''));
        } else {
          window.location.hash = '';
        }
      }
    }

    /**
     * Toggles the open/closed state of a modal.
     * @function
     */
    toggle() {
      if (this.isActive) {
        this.close();
      } else {
        this.open();
      }
    }

    /**
     * Destroys an instance of a modal.
     * @function
     */
    destroy() {
      if (this.options.overlay) {
        this.$element.appendTo($(this.options.appendTo)); // move $element outside of $overlay to prevent error unregisterPlugin()
        this.$overlay.hide().off().remove();
      }
      this.$element.hide().off();
      this.$anchor.off('.zf');
      $(window).off(`.zf.reveal:${this.id}`);

      Foundation.unregisterPlugin(this);
    }
  }

  Reveal.defaults = {
    /**
     * Motion-UI class to use for animated elements. If none used, defaults to simple show/hide.
     * @option
     * @example 'slide-in-left'
     */
    animationIn: '',
    /**
     * Motion-UI class to use for animated elements. If none used, defaults to simple show/hide.
     * @option
     * @example 'slide-out-right'
     */
    animationOut: '',
    /**
     * Time, in ms, to delay the opening of a modal after a click if no animation used.
     * @option
     * @example 10
     */
    showDelay: 0,
    /**
     * Time, in ms, to delay the closing of a modal after a click if no animation used.
     * @option
     * @example 10
     */
    hideDelay: 0,
    /**
     * Allows a click on the body/overlay to close the modal.
     * @option
     * @example true
     */
    closeOnClick: true,
    /**
     * Allows the modal to close if the user presses the `ESCAPE` key.
     * @option
     * @example true
     */
    closeOnEsc: true,
    /**
     * If true, allows multiple modals to be displayed at once.
     * @option
     * @example false
     */
    multipleOpened: false,
    /**
     * Distance, in pixels, the modal should push down from the top of the screen.
     * @option
     * @example auto
     */
    vOffset: 'auto',
    /**
     * Distance, in pixels, the modal should push in from the side of the screen.
     * @option
     * @example auto
     */
    hOffset: 'auto',
    /**
     * Allows the modal to be fullscreen, completely blocking out the rest of the view. JS checks for this as well.
     * @option
     * @example false
     */
    fullScreen: false,
    /**
     * Percentage of screen height the modal should push up from the bottom of the view.
     * @option
     * @example 10
     */
    btmOffsetPct: 10,
    /**
     * Allows the modal to generate an overlay div, which will cover the view when modal opens.
     * @option
     * @example true
     */
    overlay: true,
    /**
     * Allows the modal to remove and reinject markup on close. Should be true if using video elements w/o using provider's api, otherwise, videos will continue to play in the background.
     * @option
     * @example false
     */
    resetOnClose: false,
    /**
     * Allows the modal to alter the url on open/close, and allows the use of the `back` button to close modals. ALSO, allows a modal to auto-maniacally open on page load IF the hash === the modal's user-set id.
     * @option
     * @example false
     */
    deepLink: false,
    /**
    * Allows the modal to append to custom div.
    * @option
    * @example false
    */
    appendTo: "body"

  };

  // Window exports
  Foundation.plugin(Reveal, 'Reveal');

  function iPhoneSniff() {
    return (/iP(ad|hone|od).*OS/.test(window.navigator.userAgent)
    );
  }

  function androidSniff() {
    return (/Android/.test(window.navigator.userAgent)
    );
  }

  function mobileSniff() {
    return iPhoneSniff() || androidSniff();
  }
}(jQuery);
;'use strict';

!function ($) {

  /**
   * Slider module.
   * @module foundation.slider
   * @requires foundation.util.motion
   * @requires foundation.util.triggers
   * @requires foundation.util.keyboard
   * @requires foundation.util.touch
   */

  class Slider {
    /**
     * Creates a new instance of a slider control.
     * @class
     * @param {jQuery} element - jQuery object to make into a slider control.
     * @param {Object} options - Overrides to the default plugin settings.
     */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, Slider.defaults, this.$element.data(), options);

      this._init();

      Foundation.registerPlugin(this, 'Slider');
      Foundation.Keyboard.register('Slider', {
        'ltr': {
          'ARROW_RIGHT': 'increase',
          'ARROW_UP': 'increase',
          'ARROW_DOWN': 'decrease',
          'ARROW_LEFT': 'decrease',
          'SHIFT_ARROW_RIGHT': 'increase_fast',
          'SHIFT_ARROW_UP': 'increase_fast',
          'SHIFT_ARROW_DOWN': 'decrease_fast',
          'SHIFT_ARROW_LEFT': 'decrease_fast'
        },
        'rtl': {
          'ARROW_LEFT': 'increase',
          'ARROW_RIGHT': 'decrease',
          'SHIFT_ARROW_LEFT': 'increase_fast',
          'SHIFT_ARROW_RIGHT': 'decrease_fast'
        }
      });
    }

    /**
     * Initilizes the plugin by reading/setting attributes, creating collections and setting the initial position of the handle(s).
     * @function
     * @private
     */
    _init() {
      this.inputs = this.$element.find('input');
      this.handles = this.$element.find('[data-slider-handle]');

      this.$handle = this.handles.eq(0);
      this.$input = this.inputs.length ? this.inputs.eq(0) : $(`#${this.$handle.attr('aria-controls')}`);
      this.$fill = this.$element.find('[data-slider-fill]').css(this.options.vertical ? 'height' : 'width', 0);

      var isDbl = false,
          _this = this;
      if (this.options.disabled || this.$element.hasClass(this.options.disabledClass)) {
        this.options.disabled = true;
        this.$element.addClass(this.options.disabledClass);
      }
      if (!this.inputs.length) {
        this.inputs = $().add(this.$input);
        this.options.binding = true;
      }

      this._setInitAttr(0);

      if (this.handles[1]) {
        this.options.doubleSided = true;
        this.$handle2 = this.handles.eq(1);
        this.$input2 = this.inputs.length > 1 ? this.inputs.eq(1) : $(`#${this.$handle2.attr('aria-controls')}`);

        if (!this.inputs[1]) {
          this.inputs = this.inputs.add(this.$input2);
        }
        isDbl = true;

        // this.$handle.triggerHandler('click.zf.slider');
        this._setInitAttr(1);
      }

      // Set handle positions
      this.setHandles();

      this._events();
    }

    setHandles() {
      if (this.handles[1]) {
        this._setHandlePos(this.$handle, this.inputs.eq(0).val(), true, () => {
          this._setHandlePos(this.$handle2, this.inputs.eq(1).val(), true);
        });
      } else {
        this._setHandlePos(this.$handle, this.inputs.eq(0).val(), true);
      }
    }

    _reflow() {
      this.setHandles();
    }
    /**
    * @function
    * @private
    * @param {Number} value - floating point (the value) to be transformed using to a relative position on the slider (the inverse of _value)
    */
    _pctOfBar(value) {
      var pctOfBar = percent(value - this.options.start, this.options.end - this.options.start);

      switch (this.options.positionValueFunction) {
        case "pow":
          pctOfBar = this._logTransform(pctOfBar);
          break;
        case "log":
          pctOfBar = this._powTransform(pctOfBar);
          break;
      }

      return pctOfBar.toFixed(2);
    }

    /**
    * @function
    * @private
    * @param {Number} pctOfBar - floating point, the relative position of the slider (typically between 0-1) to be transformed to a value
    */
    _value(pctOfBar) {
      switch (this.options.positionValueFunction) {
        case "pow":
          pctOfBar = this._powTransform(pctOfBar);
          break;
        case "log":
          pctOfBar = this._logTransform(pctOfBar);
          break;
      }
      var value = (this.options.end - this.options.start) * pctOfBar + this.options.start;

      return value;
    }

    /**
    * @function
    * @private
    * @param {Number} value - floating point (typically between 0-1) to be transformed using the log function
    */
    _logTransform(value) {
      return baseLog(this.options.nonLinearBase, value * (this.options.nonLinearBase - 1) + 1);
    }

    /**
    * @function
    * @private
    * @param {Number} value - floating point (typically between 0-1) to be transformed using the power function
    */
    _powTransform(value) {
      return (Math.pow(this.options.nonLinearBase, value) - 1) / (this.options.nonLinearBase - 1);
    }

    /**
     * Sets the position of the selected handle and fill bar.
     * @function
     * @private
     * @param {jQuery} $hndl - the selected handle to move.
     * @param {Number} location - floating point between the start and end values of the slider bar.
     * @param {Function} cb - callback function to fire on completion.
     * @fires Slider#moved
     * @fires Slider#changed
     */
    _setHandlePos($hndl, location, noInvert, cb) {
      // don't move if the slider has been disabled since its initialization
      if (this.$element.hasClass(this.options.disabledClass)) {
        return;
      }
      //might need to alter that slightly for bars that will have odd number selections.
      location = parseFloat(location); //on input change events, convert string to number...grumble.

      // prevent slider from running out of bounds, if value exceeds the limits set through options, override the value to min/max
      if (location < this.options.start) {
        location = this.options.start;
      } else if (location > this.options.end) {
        location = this.options.end;
      }

      var isDbl = this.options.doubleSided;

      if (isDbl) {
        //this block is to prevent 2 handles from crossing eachother. Could/should be improved.
        if (this.handles.index($hndl) === 0) {
          var h2Val = parseFloat(this.$handle2.attr('aria-valuenow'));
          location = location >= h2Val ? h2Val - this.options.step : location;
        } else {
          var h1Val = parseFloat(this.$handle.attr('aria-valuenow'));
          location = location <= h1Val ? h1Val + this.options.step : location;
        }
      }

      //this is for single-handled vertical sliders, it adjusts the value to account for the slider being "upside-down"
      //for click and drag events, it's weird due to the scale(-1, 1) css property
      if (this.options.vertical && !noInvert) {
        location = this.options.end - location;
      }

      var _this = this,
          vert = this.options.vertical,
          hOrW = vert ? 'height' : 'width',
          lOrT = vert ? 'top' : 'left',
          handleDim = $hndl[0].getBoundingClientRect()[hOrW],
          elemDim = this.$element[0].getBoundingClientRect()[hOrW],

      //percentage of bar min/max value based on click or drag point
      pctOfBar = this._pctOfBar(location),

      //number of actual pixels to shift the handle, based on the percentage obtained above
      pxToMove = (elemDim - handleDim) * pctOfBar,

      //percentage of bar to shift the handle
      movement = (percent(pxToMove, elemDim) * 100).toFixed(this.options.decimal);
      //fixing the decimal value for the location number, is passed to other methods as a fixed floating-point value
      location = parseFloat(location.toFixed(this.options.decimal));
      // declare empty object for css adjustments, only used with 2 handled-sliders
      var css = {};

      this._setValues($hndl, location);

      // TODO update to calculate based on values set to respective inputs??
      if (isDbl) {
        var isLeftHndl = this.handles.index($hndl) === 0,

        //empty variable, will be used for min-height/width for fill bar
        dim,

        //percentage w/h of the handle compared to the slider bar
        handlePct = ~~(percent(handleDim, elemDim) * 100);
        //if left handle, the math is slightly different than if it's the right handle, and the left/top property needs to be changed for the fill bar
        if (isLeftHndl) {
          //left or top percentage value to apply to the fill bar.
          css[lOrT] = `${movement}%`;
          //calculate the new min-height/width for the fill bar.
          dim = parseFloat(this.$handle2[0].style[lOrT]) - movement + handlePct;
          //this callback is necessary to prevent errors and allow the proper placement and initialization of a 2-handled slider
          //plus, it means we don't care if 'dim' isNaN on init, it won't be in the future.
          if (cb && typeof cb === 'function') {
            cb();
          } //this is only needed for the initialization of 2 handled sliders
        } else {
          //just caching the value of the left/bottom handle's left/top property
          var handlePos = parseFloat(this.$handle[0].style[lOrT]);
          //calculate the new min-height/width for the fill bar. Use isNaN to prevent false positives for numbers <= 0
          //based on the percentage of movement of the handle being manipulated, less the opposing handle's left/top position, plus the percentage w/h of the handle itself
          dim = movement - (isNaN(handlePos) ? (this.options.initialStart - this.options.start) / ((this.options.end - this.options.start) / 100) : handlePos) + handlePct;
        }
        // assign the min-height/width to our css object
        css[`min-${hOrW}`] = `${dim}%`;
      }

      this.$element.one('finished.zf.animate', function () {
        /**
         * Fires when the handle is done moving.
         * @event Slider#moved
         */
        _this.$element.trigger('moved.zf.slider', [$hndl]);
      });

      //because we don't know exactly how the handle will be moved, check the amount of time it should take to move.
      var moveTime = this.$element.data('dragging') ? 1000 / 60 : this.options.moveTime;

      Foundation.Move(moveTime, $hndl, function () {
        // adjusting the left/top property of the handle, based on the percentage calculated above
        // if movement isNaN, that is because the slider is hidden and we cannot determine handle width,
        // fall back to next best guess.
        if (isNaN(movement)) {
          $hndl.css(lOrT, `${pctOfBar * 100}%`);
        } else {
          $hndl.css(lOrT, `${movement}%`);
        }

        if (!_this.options.doubleSided) {
          //if single-handled, a simple method to expand the fill bar
          _this.$fill.css(hOrW, `${pctOfBar * 100}%`);
        } else {
          //otherwise, use the css object we created above
          _this.$fill.css(css);
        }
      });

      /**
       * Fires when the value has not been change for a given time.
       * @event Slider#changed
       */
      clearTimeout(_this.timeout);
      _this.timeout = setTimeout(function () {
        _this.$element.trigger('changed.zf.slider', [$hndl]);
      }, _this.options.changedDelay);
    }

    /**
     * Sets the initial attribute for the slider element.
     * @function
     * @private
     * @param {Number} idx - index of the current handle/input to use.
     */
    _setInitAttr(idx) {
      var initVal = idx === 0 ? this.options.initialStart : this.options.initialEnd;
      var id = this.inputs.eq(idx).attr('id') || Foundation.GetYoDigits(6, 'slider');
      this.inputs.eq(idx).attr({
        'id': id,
        'max': this.options.end,
        'min': this.options.start,
        'step': this.options.step
      });
      this.inputs.eq(idx).val(initVal);
      this.handles.eq(idx).attr({
        'role': 'slider',
        'aria-controls': id,
        'aria-valuemax': this.options.end,
        'aria-valuemin': this.options.start,
        'aria-valuenow': initVal,
        'aria-orientation': this.options.vertical ? 'vertical' : 'horizontal',
        'tabindex': 0
      });
    }

    /**
     * Sets the input and `aria-valuenow` values for the slider element.
     * @function
     * @private
     * @param {jQuery} $handle - the currently selected handle.
     * @param {Number} val - floating point of the new value.
     */
    _setValues($handle, val) {
      var idx = this.options.doubleSided ? this.handles.index($handle) : 0;
      this.inputs.eq(idx).val(val);
      $handle.attr('aria-valuenow', val);
    }

    /**
     * Handles events on the slider element.
     * Calculates the new location of the current handle.
     * If there are two handles and the bar was clicked, it determines which handle to move.
     * @function
     * @private
     * @param {Object} e - the `event` object passed from the listener.
     * @param {jQuery} $handle - the current handle to calculate for, if selected.
     * @param {Number} val - floating point number for the new value of the slider.
     * TODO clean this up, there's a lot of repeated code between this and the _setHandlePos fn.
     */
    _handleEvent(e, $handle, val) {
      var value, hasVal;
      if (!val) {
        //click or drag events
        e.preventDefault();
        var _this = this,
            vertical = this.options.vertical,
            param = vertical ? 'height' : 'width',
            direction = vertical ? 'top' : 'left',
            eventOffset = vertical ? e.pageY : e.pageX,
            halfOfHandle = this.$handle[0].getBoundingClientRect()[param] / 2,
            barDim = this.$element[0].getBoundingClientRect()[param],
            windowScroll = vertical ? $(window).scrollTop() : $(window).scrollLeft();

        var elemOffset = this.$element.offset()[direction];

        // touch events emulated by the touch util give position relative to screen, add window.scroll to event coordinates...
        // best way to guess this is simulated is if clientY == pageY
        if (e.clientY === e.pageY) {
          eventOffset = eventOffset + windowScroll;
        }
        var eventFromBar = eventOffset - elemOffset;
        var barXY;
        if (eventFromBar < 0) {
          barXY = 0;
        } else if (eventFromBar > barDim) {
          barXY = barDim;
        } else {
          barXY = eventFromBar;
        }
        var offsetPct = percent(barXY, barDim);

        value = this._value(offsetPct);

        // turn everything around for RTL, yay math!
        if (Foundation.rtl() && !this.options.vertical) {
          value = this.options.end - value;
        }

        value = _this._adjustValue(null, value);
        //boolean flag for the setHandlePos fn, specifically for vertical sliders
        hasVal = false;

        if (!$handle) {
          //figure out which handle it is, pass it to the next function.
          var firstHndlPos = absPosition(this.$handle, direction, barXY, param),
              secndHndlPos = absPosition(this.$handle2, direction, barXY, param);
          $handle = firstHndlPos <= secndHndlPos ? this.$handle : this.$handle2;
        }
      } else {
        //change event on input
        value = this._adjustValue(null, val);
        hasVal = true;
      }

      this._setHandlePos($handle, value, hasVal);
    }

    /**
     * Adjustes value for handle in regard to step value. returns adjusted value
     * @function
     * @private
     * @param {jQuery} $handle - the selected handle.
     * @param {Number} value - value to adjust. used if $handle is falsy
     */
    _adjustValue($handle, value) {
      var val,
          step = this.options.step,
          div = parseFloat(step / 2),
          left,
          prev_val,
          next_val;
      if (!!$handle) {
        val = parseFloat($handle.attr('aria-valuenow'));
      } else {
        val = value;
      }
      left = val % step;
      prev_val = val - left;
      next_val = prev_val + step;
      if (left === 0) {
        return val;
      }
      val = val >= prev_val + div ? next_val : prev_val;
      return val;
    }

    /**
     * Adds event listeners to the slider elements.
     * @function
     * @private
     */
    _events() {
      this._eventsForHandle(this.$handle);
      if (this.handles[1]) {
        this._eventsForHandle(this.$handle2);
      }
    }

    /**
     * Adds event listeners a particular handle
     * @function
     * @private
     * @param {jQuery} $handle - the current handle to apply listeners to.
     */
    _eventsForHandle($handle) {
      var _this = this,
          curHandle,
          timer;

      this.inputs.off('change.zf.slider').on('change.zf.slider', function (e) {
        var idx = _this.inputs.index($(this));
        _this._handleEvent(e, _this.handles.eq(idx), $(this).val());
      });

      if (this.options.clickSelect) {
        this.$element.off('click.zf.slider').on('click.zf.slider', function (e) {
          if (_this.$element.data('dragging')) {
            return false;
          }

          if (!$(e.target).is('[data-slider-handle]')) {
            if (_this.options.doubleSided) {
              _this._handleEvent(e);
            } else {
              _this._handleEvent(e, _this.$handle);
            }
          }
        });
      }

      if (this.options.draggable) {
        this.handles.addTouch();

        var $body = $('body');
        $handle.off('mousedown.zf.slider').on('mousedown.zf.slider', function (e) {
          $handle.addClass('is-dragging');
          _this.$fill.addClass('is-dragging'); //
          _this.$element.data('dragging', true);

          curHandle = $(e.currentTarget);

          $body.on('mousemove.zf.slider', function (e) {
            e.preventDefault();
            _this._handleEvent(e, curHandle);
          }).on('mouseup.zf.slider', function (e) {
            _this._handleEvent(e, curHandle);

            $handle.removeClass('is-dragging');
            _this.$fill.removeClass('is-dragging');
            _this.$element.data('dragging', false);

            $body.off('mousemove.zf.slider mouseup.zf.slider');
          });
        })
        // prevent events triggered by touch
        .on('selectstart.zf.slider touchmove.zf.slider', function (e) {
          e.preventDefault();
        });
      }

      $handle.off('keydown.zf.slider').on('keydown.zf.slider', function (e) {
        var _$handle = $(this),
            idx = _this.options.doubleSided ? _this.handles.index(_$handle) : 0,
            oldValue = parseFloat(_this.inputs.eq(idx).val()),
            newValue;

        // handle keyboard event with keyboard util
        Foundation.Keyboard.handleKey(e, 'Slider', {
          decrease: function () {
            newValue = oldValue - _this.options.step;
          },
          increase: function () {
            newValue = oldValue + _this.options.step;
          },
          decrease_fast: function () {
            newValue = oldValue - _this.options.step * 10;
          },
          increase_fast: function () {
            newValue = oldValue + _this.options.step * 10;
          },
          handled: function () {
            // only set handle pos when event was handled specially
            e.preventDefault();
            _this._setHandlePos(_$handle, newValue, true);
          }
        });
        /*if (newValue) { // if pressed key has special function, update value
          e.preventDefault();
          _this._setHandlePos(_$handle, newValue);
        }*/
      });
    }

    /**
     * Destroys the slider plugin.
     */
    destroy() {
      this.handles.off('.zf.slider');
      this.inputs.off('.zf.slider');
      this.$element.off('.zf.slider');

      clearTimeout(this.timeout);

      Foundation.unregisterPlugin(this);
    }
  }

  Slider.defaults = {
    /**
     * Minimum value for the slider scale.
     * @option
     * @example 0
     */
    start: 0,
    /**
     * Maximum value for the slider scale.
     * @option
     * @example 100
     */
    end: 100,
    /**
     * Minimum value change per change event.
     * @option
     * @example 1
     */
    step: 1,
    /**
     * Value at which the handle/input *(left handle/first input)* should be set to on initialization.
     * @option
     * @example 0
     */
    initialStart: 0,
    /**
     * Value at which the right handle/second input should be set to on initialization.
     * @option
     * @example 100
     */
    initialEnd: 100,
    /**
     * Allows the input to be located outside the container and visible. Set to by the JS
     * @option
     * @example false
     */
    binding: false,
    /**
     * Allows the user to click/tap on the slider bar to select a value.
     * @option
     * @example true
     */
    clickSelect: true,
    /**
     * Set to true and use the `vertical` class to change alignment to vertical.
     * @option
     * @example false
     */
    vertical: false,
    /**
     * Allows the user to drag the slider handle(s) to select a value.
     * @option
     * @example true
     */
    draggable: true,
    /**
     * Disables the slider and prevents event listeners from being applied. Double checked by JS with `disabledClass`.
     * @option
     * @example false
     */
    disabled: false,
    /**
     * Allows the use of two handles. Double checked by the JS. Changes some logic handling.
     * @option
     * @example false
     */
    doubleSided: false,
    /**
     * Potential future feature.
     */
    // steps: 100,
    /**
     * Number of decimal places the plugin should go to for floating point precision.
     * @option
     * @example 2
     */
    decimal: 2,
    /**
     * Time delay for dragged elements.
     */
    // dragDelay: 0,
    /**
     * Time, in ms, to animate the movement of a slider handle if user clicks/taps on the bar. Needs to be manually set if updating the transition time in the Sass settings.
     * @option
     * @example 200
     */
    moveTime: 200, //update this if changing the transition time in the sass
    /**
     * Class applied to disabled sliders.
     * @option
     * @example 'disabled'
     */
    disabledClass: 'disabled',
    /**
     * Will invert the default layout for a vertical<span data-tooltip title="who would do this???"> </span>slider.
     * @option
     * @example false
     */
    invertVertical: false,
    /**
     * Milliseconds before the `changed.zf-slider` event is triggered after value change.
     * @option
     * @example 500
     */
    changedDelay: 500,
    /**
    * Basevalue for non-linear sliders
    * @option
    * @example 5
    */
    nonLinearBase: 5,
    /**
    * Basevalue for non-linear sliders, possible values are: 'linear', 'pow' & 'log'. Pow and Log use the nonLinearBase setting.
    * @option
    * @example 'linear'
    */
    positionValueFunction: 'linear'
  };

  function percent(frac, num) {
    return frac / num;
  }
  function absPosition($handle, dir, clickPos, param) {
    return Math.abs($handle.position()[dir] + $handle[param]() / 2 - clickPos);
  }
  function baseLog(base, value) {
    return Math.log(value) / Math.log(base);
  }

  // Window exports
  Foundation.plugin(Slider, 'Slider');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * Sticky module.
   * @module foundation.sticky
   * @requires foundation.util.triggers
   * @requires foundation.util.mediaQuery
   */

  class Sticky {
    /**
     * Creates a new instance of a sticky thing.
     * @class
     * @param {jQuery} element - jQuery object to make sticky.
     * @param {Object} options - options object passed when creating the element programmatically.
     */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, Sticky.defaults, this.$element.data(), options);

      this._init();

      Foundation.registerPlugin(this, 'Sticky');
    }

    /**
     * Initializes the sticky element by adding classes, getting/setting dimensions, breakpoints and attributes
     * @function
     * @private
     */
    _init() {
      var $parent = this.$element.parent('[data-sticky-container]'),
          id = this.$element[0].id || Foundation.GetYoDigits(6, 'sticky'),
          _this = this;

      if (!$parent.length) {
        this.wasWrapped = true;
      }
      this.$container = $parent.length ? $parent : $(this.options.container).wrapInner(this.$element);
      this.$container.addClass(this.options.containerClass);

      this.$element.addClass(this.options.stickyClass).attr({ 'data-resize': id });

      this.scrollCount = this.options.checkEvery;
      this.isStuck = false;
      $(window).one('load.zf.sticky', function () {
        //We calculate the container height to have correct values for anchor points offset calculation.
        _this.containerHeight = _this.$element.css("display") == "none" ? 0 : _this.$element[0].getBoundingClientRect().height;
        _this.$container.css('height', _this.containerHeight);
        _this.elemHeight = _this.containerHeight;
        if (_this.options.anchor !== '') {
          _this.$anchor = $('#' + _this.options.anchor);
        } else {
          _this._parsePoints();
        }

        _this._setSizes(function () {
          var scroll = window.pageYOffset;
          _this._calc(false, scroll);
          //Unstick the element will ensure that proper classes are set.
          if (!_this.isStuck) {
            _this._removeSticky(scroll >= _this.topPoint ? false : true);
          }
        });
        _this._events(id.split('-').reverse().join('-'));
      });
    }

    /**
     * If using multiple elements as anchors, calculates the top and bottom pixel values the sticky thing should stick and unstick on.
     * @function
     * @private
     */
    _parsePoints() {
      var top = this.options.topAnchor == "" ? 1 : this.options.topAnchor,
          btm = this.options.btmAnchor == "" ? document.documentElement.scrollHeight : this.options.btmAnchor,
          pts = [top, btm],
          breaks = {};
      for (var i = 0, len = pts.length; i < len && pts[i]; i++) {
        var pt;
        if (typeof pts[i] === 'number') {
          pt = pts[i];
        } else {
          var place = pts[i].split(':'),
              anchor = $(`#${place[0]}`);

          pt = anchor.offset().top;
          if (place[1] && place[1].toLowerCase() === 'bottom') {
            pt += anchor[0].getBoundingClientRect().height;
          }
        }
        breaks[i] = pt;
      }

      this.points = breaks;
      return;
    }

    /**
     * Adds event handlers for the scrolling element.
     * @private
     * @param {String} id - psuedo-random id for unique scroll event listener.
     */
    _events(id) {
      var _this = this,
          scrollListener = this.scrollListener = `scroll.zf.${id}`;
      if (this.isOn) {
        return;
      }
      if (this.canStick) {
        this.isOn = true;
        $(window).off(scrollListener).on(scrollListener, function (e) {
          if (_this.scrollCount === 0) {
            _this.scrollCount = _this.options.checkEvery;
            _this._setSizes(function () {
              _this._calc(false, window.pageYOffset);
            });
          } else {
            _this.scrollCount--;
            _this._calc(false, window.pageYOffset);
          }
        });
      }

      this.$element.off('resizeme.zf.trigger').on('resizeme.zf.trigger', function (e, el) {
        _this._setSizes(function () {
          _this._calc(false);
          if (_this.canStick) {
            if (!_this.isOn) {
              _this._events(id);
            }
          } else if (_this.isOn) {
            _this._pauseListeners(scrollListener);
          }
        });
      });
    }

    /**
     * Removes event handlers for scroll and change events on anchor.
     * @fires Sticky#pause
     * @param {String} scrollListener - unique, namespaced scroll listener attached to `window`
     */
    _pauseListeners(scrollListener) {
      this.isOn = false;
      $(window).off(scrollListener);

      /**
       * Fires when the plugin is paused due to resize event shrinking the view.
       * @event Sticky#pause
       * @private
       */
      this.$element.trigger('pause.zf.sticky');
    }

    /**
     * Called on every `scroll` event and on `_init`
     * fires functions based on booleans and cached values
     * @param {Boolean} checkSizes - true if plugin should recalculate sizes and breakpoints.
     * @param {Number} scroll - current scroll position passed from scroll event cb function. If not passed, defaults to `window.pageYOffset`.
     */
    _calc(checkSizes, scroll) {
      if (checkSizes) {
        this._setSizes();
      }

      if (!this.canStick) {
        if (this.isStuck) {
          this._removeSticky(true);
        }
        return false;
      }

      if (!scroll) {
        scroll = window.pageYOffset;
      }

      if (scroll >= this.topPoint) {
        if (scroll <= this.bottomPoint) {
          if (!this.isStuck) {
            this._setSticky();
          }
        } else {
          if (this.isStuck) {
            this._removeSticky(false);
          }
        }
      } else {
        if (this.isStuck) {
          this._removeSticky(true);
        }
      }
    }

    /**
     * Causes the $element to become stuck.
     * Adds `position: fixed;`, and helper classes.
     * @fires Sticky#stuckto
     * @function
     * @private
     */
    _setSticky() {
      var _this = this,
          stickTo = this.options.stickTo,
          mrgn = stickTo === 'top' ? 'marginTop' : 'marginBottom',
          notStuckTo = stickTo === 'top' ? 'bottom' : 'top',
          css = {};

      css[mrgn] = `${this.options[mrgn]}em`;
      css[stickTo] = 0;
      css[notStuckTo] = 'auto';
      this.isStuck = true;
      this.$element.removeClass(`is-anchored is-at-${notStuckTo}`).addClass(`is-stuck is-at-${stickTo}`).css(css)
      /**
       * Fires when the $element has become `position: fixed;`
       * Namespaced to `top` or `bottom`, e.g. `sticky.zf.stuckto:top`
       * @event Sticky#stuckto
       */
      .trigger(`sticky.zf.stuckto:${stickTo}`);
      this.$element.on("transitionend webkitTransitionEnd oTransitionEnd otransitionend MSTransitionEnd", function () {
        _this._setSizes();
      });
    }

    /**
     * Causes the $element to become unstuck.
     * Removes `position: fixed;`, and helper classes.
     * Adds other helper classes.
     * @param {Boolean} isTop - tells the function if the $element should anchor to the top or bottom of its $anchor element.
     * @fires Sticky#unstuckfrom
     * @private
     */
    _removeSticky(isTop) {
      var stickTo = this.options.stickTo,
          stickToTop = stickTo === 'top',
          css = {},
          anchorPt = (this.points ? this.points[1] - this.points[0] : this.anchorHeight) - this.elemHeight,
          mrgn = stickToTop ? 'marginTop' : 'marginBottom',
          notStuckTo = stickToTop ? 'bottom' : 'top',
          topOrBottom = isTop ? 'top' : 'bottom';

      css[mrgn] = 0;

      css['bottom'] = 'auto';
      if (isTop) {
        css['top'] = 0;
      } else {
        css['top'] = anchorPt;
      }

      this.isStuck = false;
      this.$element.removeClass(`is-stuck is-at-${stickTo}`).addClass(`is-anchored is-at-${topOrBottom}`).css(css)
      /**
       * Fires when the $element has become anchored.
       * Namespaced to `top` or `bottom`, e.g. `sticky.zf.unstuckfrom:bottom`
       * @event Sticky#unstuckfrom
       */
      .trigger(`sticky.zf.unstuckfrom:${topOrBottom}`);
    }

    /**
     * Sets the $element and $container sizes for plugin.
     * Calls `_setBreakPoints`.
     * @param {Function} cb - optional callback function to fire on completion of `_setBreakPoints`.
     * @private
     */
    _setSizes(cb) {
      this.canStick = Foundation.MediaQuery.is(this.options.stickyOn);
      if (!this.canStick) {
        if (cb && typeof cb === 'function') {
          cb();
        }
      }
      var _this = this,
          newElemWidth = this.$container[0].getBoundingClientRect().width,
          comp = window.getComputedStyle(this.$container[0]),
          pdngl = parseInt(comp['padding-left'], 10),
          pdngr = parseInt(comp['padding-right'], 10);

      if (this.$anchor && this.$anchor.length) {
        this.anchorHeight = this.$anchor[0].getBoundingClientRect().height;
      } else {
        this._parsePoints();
      }

      this.$element.css({
        'max-width': `${newElemWidth - pdngl - pdngr}px`
      });

      var newContainerHeight = this.$element[0].getBoundingClientRect().height || this.containerHeight;
      if (this.$element.css("display") == "none") {
        newContainerHeight = 0;
      }
      this.containerHeight = newContainerHeight;
      this.$container.css({
        height: newContainerHeight
      });
      this.elemHeight = newContainerHeight;

      if (!this.isStuck) {
        if (this.$element.hasClass('is-at-bottom')) {
          var anchorPt = (this.points ? this.points[1] - this.$container.offset().top : this.anchorHeight) - this.elemHeight;
          this.$element.css('top', anchorPt);
        }
      }

      this._setBreakPoints(newContainerHeight, function () {
        if (cb && typeof cb === 'function') {
          cb();
        }
      });
    }

    /**
     * Sets the upper and lower breakpoints for the element to become sticky/unsticky.
     * @param {Number} elemHeight - px value for sticky.$element height, calculated by `_setSizes`.
     * @param {Function} cb - optional callback function to be called on completion.
     * @private
     */
    _setBreakPoints(elemHeight, cb) {
      if (!this.canStick) {
        if (cb && typeof cb === 'function') {
          cb();
        } else {
          return false;
        }
      }
      var mTop = emCalc(this.options.marginTop),
          mBtm = emCalc(this.options.marginBottom),
          topPoint = this.points ? this.points[0] : this.$anchor.offset().top,
          bottomPoint = this.points ? this.points[1] : topPoint + this.anchorHeight,

      // topPoint = this.$anchor.offset().top || this.points[0],
      // bottomPoint = topPoint + this.anchorHeight || this.points[1],
      winHeight = window.innerHeight;

      if (this.options.stickTo === 'top') {
        topPoint -= mTop;
        bottomPoint -= elemHeight + mTop;
      } else if (this.options.stickTo === 'bottom') {
        topPoint -= winHeight - (elemHeight + mBtm);
        bottomPoint -= winHeight - mBtm;
      } else {
        //this would be the stickTo: both option... tricky
      }

      this.topPoint = topPoint;
      this.bottomPoint = bottomPoint;

      if (cb && typeof cb === 'function') {
        cb();
      }
    }

    /**
     * Destroys the current sticky element.
     * Resets the element to the top position first.
     * Removes event listeners, JS-added css properties and classes, and unwraps the $element if the JS added the $container.
     * @function
     */
    destroy() {
      this._removeSticky(true);

      this.$element.removeClass(`${this.options.stickyClass} is-anchored is-at-top`).css({
        height: '',
        top: '',
        bottom: '',
        'max-width': ''
      }).off('resizeme.zf.trigger');
      if (this.$anchor && this.$anchor.length) {
        this.$anchor.off('change.zf.sticky');
      }
      $(window).off(this.scrollListener);

      if (this.wasWrapped) {
        this.$element.unwrap();
      } else {
        this.$container.removeClass(this.options.containerClass).css({
          height: ''
        });
      }
      Foundation.unregisterPlugin(this);
    }
  }

  Sticky.defaults = {
    /**
     * Customizable container template. Add your own classes for styling and sizing.
     * @option
     * @example '&lt;div data-sticky-container class="small-6 columns"&gt;&lt;/div&gt;'
     */
    container: '<div data-sticky-container></div>',
    /**
     * Location in the view the element sticks to.
     * @option
     * @example 'top'
     */
    stickTo: 'top',
    /**
     * If anchored to a single element, the id of that element.
     * @option
     * @example 'exampleId'
     */
    anchor: '',
    /**
     * If using more than one element as anchor points, the id of the top anchor.
     * @option
     * @example 'exampleId:top'
     */
    topAnchor: '',
    /**
     * If using more than one element as anchor points, the id of the bottom anchor.
     * @option
     * @example 'exampleId:bottom'
     */
    btmAnchor: '',
    /**
     * Margin, in `em`'s to apply to the top of the element when it becomes sticky.
     * @option
     * @example 1
     */
    marginTop: 1,
    /**
     * Margin, in `em`'s to apply to the bottom of the element when it becomes sticky.
     * @option
     * @example 1
     */
    marginBottom: 1,
    /**
     * Breakpoint string that is the minimum screen size an element should become sticky.
     * @option
     * @example 'medium'
     */
    stickyOn: 'medium',
    /**
     * Class applied to sticky element, and removed on destruction. Foundation defaults to `sticky`.
     * @option
     * @example 'sticky'
     */
    stickyClass: 'sticky',
    /**
     * Class applied to sticky container. Foundation defaults to `sticky-container`.
     * @option
     * @example 'sticky-container'
     */
    containerClass: 'sticky-container',
    /**
     * Number of scroll events between the plugin's recalculating sticky points. Setting it to `0` will cause it to recalc every scroll event, setting it to `-1` will prevent recalc on scroll.
     * @option
     * @example 50
     */
    checkEvery: -1
  };

  /**
   * Helper function to calculate em values
   * @param Number {em} - number of em's to calculate into pixels
   */
  function emCalc(em) {
    return parseInt(window.getComputedStyle(document.body, null).fontSize, 10) * em;
  }

  // Window exports
  Foundation.plugin(Sticky, 'Sticky');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * Tabs module.
   * @module foundation.tabs
   * @requires foundation.util.keyboard
   * @requires foundation.util.timerAndImageLoader if tabs contain images
   */

  class Tabs {
    /**
     * Creates a new instance of tabs.
     * @class
     * @fires Tabs#init
     * @param {jQuery} element - jQuery object to make into tabs.
     * @param {Object} options - Overrides to the default plugin settings.
     */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, Tabs.defaults, this.$element.data(), options);

      this._init();
      Foundation.registerPlugin(this, 'Tabs');
      Foundation.Keyboard.register('Tabs', {
        'ENTER': 'open',
        'SPACE': 'open',
        'ARROW_RIGHT': 'next',
        'ARROW_UP': 'previous',
        'ARROW_DOWN': 'next',
        'ARROW_LEFT': 'previous'
        // 'TAB': 'next',
        // 'SHIFT_TAB': 'previous'
      });
    }

    /**
     * Initializes the tabs by showing and focusing (if autoFocus=true) the preset active tab.
     * @private
     */
    _init() {
      var _this = this;

      this.$element.attr({ 'role': 'tablist' });
      this.$tabTitles = this.$element.find(`.${this.options.linkClass}`);
      this.$tabContent = $(`[data-tabs-content="${this.$element[0].id}"]`);

      this.$tabTitles.each(function () {
        var $elem = $(this),
            $link = $elem.find('a'),
            isActive = $elem.hasClass(`${_this.options.linkActiveClass}`),
            hash = $link[0].hash.slice(1),
            linkId = $link[0].id ? $link[0].id : `${hash}-label`,
            $tabContent = $(`#${hash}`);

        $elem.attr({ 'role': 'presentation' });

        $link.attr({
          'role': 'tab',
          'aria-controls': hash,
          'aria-selected': isActive,
          'id': linkId
        });

        $tabContent.attr({
          'role': 'tabpanel',
          'aria-hidden': !isActive,
          'aria-labelledby': linkId
        });

        if (isActive && _this.options.autoFocus) {
          $(window).load(function () {
            $('html, body').animate({ scrollTop: $elem.offset().top }, _this.options.deepLinkSmudgeDelay, () => {
              $link.focus();
            });
          });
        }

        //use browser to open a tab, if it exists in this tabset
        if (_this.options.deepLink) {
          var anchor = window.location.hash;
          //need a hash and a relevant anchor in this tabset
          if (anchor.length) {
            var $link = $elem.find('[href="' + anchor + '"]');
            if ($link.length) {
              _this.selectTab($(anchor));

              //roll up a little to show the titles
              if (_this.options.deepLinkSmudge) {
                $(window).load(function () {
                  var offset = $elem.offset();
                  $('html, body').animate({ scrollTop: offset.top }, _this.options.deepLinkSmudgeDelay);
                });
              }

              /**
                * Fires when the zplugin has deeplinked at pageload
                * @event Tabs#deeplink
                */
              $elem.trigger('deeplink.zf.tabs', [$link, $(anchor)]);
            }
          }
        }
      });

      if (this.options.matchHeight) {
        var $images = this.$tabContent.find('img');

        if ($images.length) {
          Foundation.onImagesLoaded($images, this._setHeight.bind(this));
        } else {
          this._setHeight();
        }
      }

      this._events();
    }

    /**
     * Adds event handlers for items within the tabs.
     * @private
     */
    _events() {
      this._addKeyHandler();
      this._addClickHandler();
      this._setHeightMqHandler = null;

      if (this.options.matchHeight) {
        this._setHeightMqHandler = this._setHeight.bind(this);

        $(window).on('changed.zf.mediaquery', this._setHeightMqHandler);
      }
    }

    /**
     * Adds click handlers for items within the tabs.
     * @private
     */
    _addClickHandler() {
      var _this = this;

      this.$element.off('click.zf.tabs').on('click.zf.tabs', `.${this.options.linkClass}`, function (e) {
        e.preventDefault();
        e.stopPropagation();
        _this._handleTabChange($(this));
      });
    }

    /**
     * Adds keyboard event handlers for items within the tabs.
     * @private
     */
    _addKeyHandler() {
      var _this = this;

      this.$tabTitles.off('keydown.zf.tabs').on('keydown.zf.tabs', function (e) {
        if (e.which === 9) return;

        var $element = $(this),
            $elements = $element.parent('ul').children('li'),
            $prevElement,
            $nextElement;

        $elements.each(function (i) {
          if ($(this).is($element)) {
            if (_this.options.wrapOnKeys) {
              $prevElement = i === 0 ? $elements.last() : $elements.eq(i - 1);
              $nextElement = i === $elements.length - 1 ? $elements.first() : $elements.eq(i + 1);
            } else {
              $prevElement = $elements.eq(Math.max(0, i - 1));
              $nextElement = $elements.eq(Math.min(i + 1, $elements.length - 1));
            }
            return;
          }
        });

        // handle keyboard event with keyboard util
        Foundation.Keyboard.handleKey(e, 'Tabs', {
          open: function () {
            $element.find('[role="tab"]').focus();
            _this._handleTabChange($element);
          },
          previous: function () {
            $prevElement.find('[role="tab"]').focus();
            _this._handleTabChange($prevElement);
          },
          next: function () {
            $nextElement.find('[role="tab"]').focus();
            _this._handleTabChange($nextElement);
          },
          handled: function () {
            e.stopPropagation();
            e.preventDefault();
          }
        });
      });
    }

    /**
     * Opens the tab `$targetContent` defined by `$target`. Collapses active tab.
     * @param {jQuery} $target - Tab to open.
     * @fires Tabs#change
     * @function
     */
    _handleTabChange($target) {

      /**
       * Check for active class on target. Collapse if exists.
       */
      if ($target.hasClass(`${this.options.linkActiveClass}`)) {
        if (this.options.activeCollapse) {
          this._collapseTab($target);

          /**
           * Fires when the zplugin has successfully collapsed tabs.
           * @event Tabs#collapse
           */
          this.$element.trigger('collapse.zf.tabs', [$target]);
        }
        return;
      }

      var $oldTab = this.$element.find(`.${this.options.linkClass}.${this.options.linkActiveClass}`),
          $tabLink = $target.find('[role="tab"]'),
          hash = $tabLink[0].hash,
          $targetContent = this.$tabContent.find(hash);

      //close old tab
      this._collapseTab($oldTab);

      //open new tab
      this._openTab($target);

      //either replace or update browser history
      if (this.options.deepLink) {
        var anchor = $target.find('a').attr('href');

        if (this.options.updateHistory) {
          history.pushState({}, '', anchor);
        } else {
          history.replaceState({}, '', anchor);
        }
      }

      /**
       * Fires when the plugin has successfully changed tabs.
       * @event Tabs#change
       */
      this.$element.trigger('change.zf.tabs', [$target, $targetContent]);

      //fire to children a mutation event
      $targetContent.find("[data-mutate]").trigger("mutateme.zf.trigger");
    }

    /**
     * Opens the tab `$targetContent` defined by `$target`.
     * @param {jQuery} $target - Tab to Open.
     * @function
     */
    _openTab($target) {
      var $tabLink = $target.find('[role="tab"]'),
          hash = $tabLink[0].hash,
          $targetContent = this.$tabContent.find(hash);

      $target.addClass(`${this.options.linkActiveClass}`);

      $tabLink.attr({ 'aria-selected': 'true' });

      $targetContent.addClass(`${this.options.panelActiveClass}`).attr({ 'aria-hidden': 'false' });
    }

    /**
     * Collapses `$targetContent` defined by `$target`.
     * @param {jQuery} $target - Tab to Open.
     * @function
     */
    _collapseTab($target) {
      var $target_anchor = $target.removeClass(`${this.options.linkActiveClass}`).find('[role="tab"]').attr({ 'aria-selected': 'false' });

      $(`#${$target_anchor.attr('aria-controls')}`).removeClass(`${this.options.panelActiveClass}`).attr({ 'aria-hidden': 'true' });
    }

    /**
     * Public method for selecting a content pane to display.
     * @param {jQuery | String} elem - jQuery object or string of the id of the pane to display.
     * @function
     */
    selectTab(elem) {
      var idStr;

      if (typeof elem === 'object') {
        idStr = elem[0].id;
      } else {
        idStr = elem;
      }

      if (idStr.indexOf('#') < 0) {
        idStr = `#${idStr}`;
      }

      var $target = this.$tabTitles.find(`[href="${idStr}"]`).parent(`.${this.options.linkClass}`);

      this._handleTabChange($target);
    }
    /**
     * Sets the height of each panel to the height of the tallest panel.
     * If enabled in options, gets called on media query change.
     * If loading content via external source, can be called directly or with _reflow.
     * @function
     * @private
     */
    _setHeight() {
      var max = 0;
      this.$tabContent.find(`.${this.options.panelClass}`).css('height', '').each(function () {
        var panel = $(this),
            isActive = panel.hasClass(`${this.options.panelActiveClass}`);

        if (!isActive) {
          panel.css({ 'visibility': 'hidden', 'display': 'block' });
        }

        var temp = this.getBoundingClientRect().height;

        if (!isActive) {
          panel.css({
            'visibility': '',
            'display': ''
          });
        }

        max = temp > max ? temp : max;
      }).css('height', `${max}px`);
    }

    /**
     * Destroys an instance of an tabs.
     * @fires Tabs#destroyed
     */
    destroy() {
      this.$element.find(`.${this.options.linkClass}`).off('.zf.tabs').hide().end().find(`.${this.options.panelClass}`).hide();

      if (this.options.matchHeight) {
        if (this._setHeightMqHandler != null) {
          $(window).off('changed.zf.mediaquery', this._setHeightMqHandler);
        }
      }

      Foundation.unregisterPlugin(this);
    }
  }

  Tabs.defaults = {
    /**
     * Allows the window to scroll to content of pane specified by hash anchor
     * @option
     * @example false
     */
    deepLink: false,

    /**
     * Adjust the deep link scroll to make sure the top of the tab panel is visible
     * @option
     * @example false
     */
    deepLinkSmudge: false,

    /**
     * Animation time (ms) for the deep link adjustment
     * @option
     * @example 300
     */
    deepLinkSmudgeDelay: 300,

    /**
     * Update the browser history with the open tab
     * @option
     * @example false
     */
    updateHistory: false,

    /**
     * Allows the window to scroll to content of active pane on load if set to true.
     * Not recommended if more than one tab panel per page.
     * @option
     * @example false
     */
    autoFocus: false,

    /**
     * Allows keyboard input to 'wrap' around the tab links.
     * @option
     * @example true
     */
    wrapOnKeys: true,

    /**
     * Allows the tab content panes to match heights if set to true.
     * @option
     * @example false
     */
    matchHeight: false,

    /**
     * Allows active tabs to collapse when clicked.
     * @option
     * @example false
     */
    activeCollapse: false,

    /**
     * Class applied to `li`'s in tab link list.
     * @option
     * @example 'tabs-title'
     */
    linkClass: 'tabs-title',

    /**
     * Class applied to the active `li` in tab link list.
     * @option
     * @example 'is-active'
     */
    linkActiveClass: 'is-active',

    /**
     * Class applied to the content containers.
     * @option
     * @example 'tabs-panel'
     */
    panelClass: 'tabs-panel',

    /**
     * Class applied to the active content container.
     * @option
     * @example 'is-active'
     */
    panelActiveClass: 'is-active'
  };

  // Window exports
  Foundation.plugin(Tabs, 'Tabs');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * Toggler module.
   * @module foundation.toggler
   * @requires foundation.util.motion
   * @requires foundation.util.triggers
   */

  class Toggler {
    /**
     * Creates a new instance of Toggler.
     * @class
     * @fires Toggler#init
     * @param {Object} element - jQuery object to add the trigger to.
     * @param {Object} options - Overrides to the default plugin settings.
     */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, Toggler.defaults, element.data(), options);
      this.className = '';

      this._init();
      this._events();

      Foundation.registerPlugin(this, 'Toggler');
    }

    /**
     * Initializes the Toggler plugin by parsing the toggle class from data-toggler, or animation classes from data-animate.
     * @function
     * @private
     */
    _init() {
      var input;
      // Parse animation classes if they were set
      if (this.options.animate) {
        input = this.options.animate.split(' ');

        this.animationIn = input[0];
        this.animationOut = input[1] || null;
      }
      // Otherwise, parse toggle class
      else {
          input = this.$element.data('toggler');
          // Allow for a . at the beginning of the string
          this.className = input[0] === '.' ? input.slice(1) : input;
        }

      // Add ARIA attributes to triggers
      var id = this.$element[0].id;
      $(`[data-open="${id}"], [data-close="${id}"], [data-toggle="${id}"]`).attr('aria-controls', id);
      // If the target is hidden, add aria-hidden
      this.$element.attr('aria-expanded', this.$element.is(':hidden') ? false : true);
    }

    /**
     * Initializes events for the toggle trigger.
     * @function
     * @private
     */
    _events() {
      this.$element.off('toggle.zf.trigger').on('toggle.zf.trigger', this.toggle.bind(this));
    }

    /**
     * Toggles the target class on the target element. An event is fired from the original trigger depending on if the resultant state was "on" or "off".
     * @function
     * @fires Toggler#on
     * @fires Toggler#off
     */
    toggle() {
      this[this.options.animate ? '_toggleAnimate' : '_toggleClass']();
    }

    _toggleClass() {
      this.$element.toggleClass(this.className);

      var isOn = this.$element.hasClass(this.className);
      if (isOn) {
        /**
         * Fires if the target element has the class after a toggle.
         * @event Toggler#on
         */
        this.$element.trigger('on.zf.toggler');
      } else {
        /**
         * Fires if the target element does not have the class after a toggle.
         * @event Toggler#off
         */
        this.$element.trigger('off.zf.toggler');
      }

      this._updateARIA(isOn);
      this.$element.find('[data-mutate]').trigger('mutateme.zf.trigger');
    }

    _toggleAnimate() {
      var _this = this;

      if (this.$element.is(':hidden')) {
        Foundation.Motion.animateIn(this.$element, this.animationIn, function () {
          _this._updateARIA(true);
          this.trigger('on.zf.toggler');
          this.find('[data-mutate]').trigger('mutateme.zf.trigger');
        });
      } else {
        Foundation.Motion.animateOut(this.$element, this.animationOut, function () {
          _this._updateARIA(false);
          this.trigger('off.zf.toggler');
          this.find('[data-mutate]').trigger('mutateme.zf.trigger');
        });
      }
    }

    _updateARIA(isOn) {
      this.$element.attr('aria-expanded', isOn ? true : false);
    }

    /**
     * Destroys the instance of Toggler on the element.
     * @function
     */
    destroy() {
      this.$element.off('.zf.toggler');
      Foundation.unregisterPlugin(this);
    }
  }

  Toggler.defaults = {
    /**
     * Tells the plugin if the element should animated when toggled.
     * @option
     * @example false
     */
    animate: false
  };

  // Window exports
  Foundation.plugin(Toggler, 'Toggler');
}(jQuery);
;'use strict';

!function ($) {

  /**
   * Tooltip module.
   * @module foundation.tooltip
   * @requires foundation.util.box
   * @requires foundation.util.mediaQuery
   * @requires foundation.util.triggers
   */

  class Tooltip {
    /**
     * Creates a new instance of a Tooltip.
     * @class
     * @fires Tooltip#init
     * @param {jQuery} element - jQuery object to attach a tooltip to.
     * @param {Object} options - object to extend the default configuration.
     */
    constructor(element, options) {
      this.$element = element;
      this.options = $.extend({}, Tooltip.defaults, this.$element.data(), options);

      this.isActive = false;
      this.isClick = false;
      this._init();

      Foundation.registerPlugin(this, 'Tooltip');
    }

    /**
     * Initializes the tooltip by setting the creating the tip element, adding it's text, setting private variables and setting attributes on the anchor.
     * @private
     */
    _init() {
      var elemId = this.$element.attr('aria-describedby') || Foundation.GetYoDigits(6, 'tooltip');

      this.options.positionClass = this.options.positionClass || this._getPositionClass(this.$element);
      this.options.tipText = this.options.tipText || this.$element.attr('title');
      this.template = this.options.template ? $(this.options.template) : this._buildTemplate(elemId);

      if (this.options.allowHtml) {
        this.template.appendTo(document.body).html(this.options.tipText).hide();
      } else {
        this.template.appendTo(document.body).text(this.options.tipText).hide();
      }

      this.$element.attr({
        'title': '',
        'aria-describedby': elemId,
        'data-yeti-box': elemId,
        'data-toggle': elemId,
        'data-resize': elemId
      }).addClass(this.options.triggerClass);

      //helper variables to track movement on collisions
      this.usedPositions = [];
      this.counter = 4;
      this.classChanged = false;

      this._events();
    }

    /**
     * Grabs the current positioning class, if present, and returns the value or an empty string.
     * @private
     */
    _getPositionClass(element) {
      if (!element) {
        return '';
      }
      // var position = element.attr('class').match(/top|left|right/g);
      var position = element[0].className.match(/\b(top|left|right)\b/g);
      position = position ? position[0] : '';
      return position;
    }
    /**
     * builds the tooltip element, adds attributes, and returns the template.
     * @private
     */
    _buildTemplate(id) {
      var templateClasses = `${this.options.tooltipClass} ${this.options.positionClass} ${this.options.templateClasses}`.trim();
      var $template = $('<div></div>').addClass(templateClasses).attr({
        'role': 'tooltip',
        'aria-hidden': true,
        'data-is-active': false,
        'data-is-focus': false,
        'id': id
      });
      return $template;
    }

    /**
     * Function that gets called if a collision event is detected.
     * @param {String} position - positioning class to try
     * @private
     */
    _reposition(position) {
      this.usedPositions.push(position ? position : 'bottom');

      //default, try switching to opposite side
      if (!position && this.usedPositions.indexOf('top') < 0) {
        this.template.addClass('top');
      } else if (position === 'top' && this.usedPositions.indexOf('bottom') < 0) {
        this.template.removeClass(position);
      } else if (position === 'left' && this.usedPositions.indexOf('right') < 0) {
        this.template.removeClass(position).addClass('right');
      } else if (position === 'right' && this.usedPositions.indexOf('left') < 0) {
        this.template.removeClass(position).addClass('left');
      }

      //if default change didn't work, try bottom or left first
      else if (!position && this.usedPositions.indexOf('top') > -1 && this.usedPositions.indexOf('left') < 0) {
          this.template.addClass('left');
        } else if (position === 'top' && this.usedPositions.indexOf('bottom') > -1 && this.usedPositions.indexOf('left') < 0) {
          this.template.removeClass(position).addClass('left');
        } else if (position === 'left' && this.usedPositions.indexOf('right') > -1 && this.usedPositions.indexOf('bottom') < 0) {
          this.template.removeClass(position);
        } else if (position === 'right' && this.usedPositions.indexOf('left') > -1 && this.usedPositions.indexOf('bottom') < 0) {
          this.template.removeClass(position);
        }
        //if nothing cleared, set to bottom
        else {
            this.template.removeClass(position);
          }
      this.classChanged = true;
      this.counter--;
    }

    /**
     * sets the position class of an element and recursively calls itself until there are no more possible positions to attempt, or the tooltip element is no longer colliding.
     * if the tooltip is larger than the screen width, default to full width - any user selected margin
     * @private
     */
    _setPosition() {
      var position = this._getPositionClass(this.template),
          $tipDims = Foundation.Box.GetDimensions(this.template),
          $anchorDims = Foundation.Box.GetDimensions(this.$element),
          direction = position === 'left' ? 'left' : position === 'right' ? 'left' : 'top',
          param = direction === 'top' ? 'height' : 'width',
          offset = param === 'height' ? this.options.vOffset : this.options.hOffset,
          _this = this;

      if ($tipDims.width >= $tipDims.windowDims.width || !this.counter && !Foundation.Box.ImNotTouchingYou(this.template)) {
        this.template.offset(Foundation.Box.GetOffsets(this.template, this.$element, 'center bottom', this.options.vOffset, this.options.hOffset, true)).css({
          // this.$element.offset(Foundation.GetOffsets(this.template, this.$element, 'center bottom', this.options.vOffset, this.options.hOffset, true)).css({
          'width': $anchorDims.windowDims.width - this.options.hOffset * 2,
          'height': 'auto'
        });
        return false;
      }

      this.template.offset(Foundation.Box.GetOffsets(this.template, this.$element, 'center ' + (position || 'bottom'), this.options.vOffset, this.options.hOffset));

      while (!Foundation.Box.ImNotTouchingYou(this.template) && this.counter) {
        this._reposition(position);
        this._setPosition();
      }
    }

    /**
     * reveals the tooltip, and fires an event to close any other open tooltips on the page
     * @fires Tooltip#closeme
     * @fires Tooltip#show
     * @function
     */
    show() {
      if (this.options.showOn !== 'all' && !Foundation.MediaQuery.is(this.options.showOn)) {
        // console.error('The screen is too small to display this tooltip');
        return false;
      }

      var _this = this;
      this.template.css('visibility', 'hidden').show();
      this._setPosition();

      /**
       * Fires to close all other open tooltips on the page
       * @event Closeme#tooltip
       */
      this.$element.trigger('closeme.zf.tooltip', this.template.attr('id'));

      this.template.attr({
        'data-is-active': true,
        'aria-hidden': false
      });
      _this.isActive = true;
      // console.log(this.template);
      this.template.stop().hide().css('visibility', '').fadeIn(this.options.fadeInDuration, function () {
        //maybe do stuff?
      });
      /**
       * Fires when the tooltip is shown
       * @event Tooltip#show
       */
      this.$element.trigger('show.zf.tooltip');
    }

    /**
     * Hides the current tooltip, and resets the positioning class if it was changed due to collision
     * @fires Tooltip#hide
     * @function
     */
    hide() {
      // console.log('hiding', this.$element.data('yeti-box'));
      var _this = this;
      this.template.stop().attr({
        'aria-hidden': true,
        'data-is-active': false
      }).fadeOut(this.options.fadeOutDuration, function () {
        _this.isActive = false;
        _this.isClick = false;
        if (_this.classChanged) {
          _this.template.removeClass(_this._getPositionClass(_this.template)).addClass(_this.options.positionClass);

          _this.usedPositions = [];
          _this.counter = 4;
          _this.classChanged = false;
        }
      });
      /**
       * fires when the tooltip is hidden
       * @event Tooltip#hide
       */
      this.$element.trigger('hide.zf.tooltip');
    }

    /**
     * adds event listeners for the tooltip and its anchor
     * TODO combine some of the listeners like focus and mouseenter, etc.
     * @private
     */
    _events() {
      var _this = this;
      var $template = this.template;
      var isFocus = false;

      if (!this.options.disableHover) {

        this.$element.on('mouseenter.zf.tooltip', function (e) {
          if (!_this.isActive) {
            _this.timeout = setTimeout(function () {
              _this.show();
            }, _this.options.hoverDelay);
          }
        }).on('mouseleave.zf.tooltip', function (e) {
          clearTimeout(_this.timeout);
          if (!isFocus || _this.isClick && !_this.options.clickOpen) {
            _this.hide();
          }
        });
      }

      if (this.options.clickOpen) {
        this.$element.on('mousedown.zf.tooltip', function (e) {
          e.stopImmediatePropagation();
          if (_this.isClick) {
            //_this.hide();
            // _this.isClick = false;
          } else {
            _this.isClick = true;
            if ((_this.options.disableHover || !_this.$element.attr('tabindex')) && !_this.isActive) {
              _this.show();
            }
          }
        });
      } else {
        this.$element.on('mousedown.zf.tooltip', function (e) {
          e.stopImmediatePropagation();
          _this.isClick = true;
        });
      }

      if (!this.options.disableForTouch) {
        this.$element.on('tap.zf.tooltip touchend.zf.tooltip', function (e) {
          _this.isActive ? _this.hide() : _this.show();
        });
      }

      this.$element.on({
        // 'toggle.zf.trigger': this.toggle.bind(this),
        // 'close.zf.trigger': this.hide.bind(this)
        'close.zf.trigger': this.hide.bind(this)
      });

      this.$element.on('focus.zf.tooltip', function (e) {
        isFocus = true;
        if (_this.isClick) {
          // If we're not showing open on clicks, we need to pretend a click-launched focus isn't
          // a real focus, otherwise on hover and come back we get bad behavior
          if (!_this.options.clickOpen) {
            isFocus = false;
          }
          return false;
        } else {
          _this.show();
        }
      }).on('focusout.zf.tooltip', function (e) {
        isFocus = false;
        _this.isClick = false;
        _this.hide();
      }).on('resizeme.zf.trigger', function () {
        if (_this.isActive) {
          _this._setPosition();
        }
      });
    }

    /**
     * adds a toggle method, in addition to the static show() & hide() functions
     * @function
     */
    toggle() {
      if (this.isActive) {
        this.hide();
      } else {
        this.show();
      }
    }

    /**
     * Destroys an instance of tooltip, removes template element from the view.
     * @function
     */
    destroy() {
      this.$element.attr('title', this.template.text()).off('.zf.trigger .zf.tooltip').removeClass('has-tip top right left').removeAttr('aria-describedby aria-haspopup data-disable-hover data-resize data-toggle data-tooltip data-yeti-box');

      this.template.remove();

      Foundation.unregisterPlugin(this);
    }
  }

  Tooltip.defaults = {
    disableForTouch: false,
    /**
     * Time, in ms, before a tooltip should open on hover.
     * @option
     * @example 200
     */
    hoverDelay: 200,
    /**
     * Time, in ms, a tooltip should take to fade into view.
     * @option
     * @example 150
     */
    fadeInDuration: 150,
    /**
     * Time, in ms, a tooltip should take to fade out of view.
     * @option
     * @example 150
     */
    fadeOutDuration: 150,
    /**
     * Disables hover events from opening the tooltip if set to true
     * @option
     * @example false
     */
    disableHover: false,
    /**
     * Optional addtional classes to apply to the tooltip template on init.
     * @option
     * @example 'my-cool-tip-class'
     */
    templateClasses: '',
    /**
     * Non-optional class added to tooltip templates. Foundation default is 'tooltip'.
     * @option
     * @example 'tooltip'
     */
    tooltipClass: 'tooltip',
    /**
     * Class applied to the tooltip anchor element.
     * @option
     * @example 'has-tip'
     */
    triggerClass: 'has-tip',
    /**
     * Minimum breakpoint size at which to open the tooltip.
     * @option
     * @example 'small'
     */
    showOn: 'small',
    /**
     * Custom template to be used to generate markup for tooltip.
     * @option
     * @example '&lt;div class="tooltip"&gt;&lt;/div&gt;'
     */
    template: '',
    /**
     * Text displayed in the tooltip template on open.
     * @option
     * @example 'Some cool space fact here.'
     */
    tipText: '',
    touchCloseText: 'Tap to close.',
    /**
     * Allows the tooltip to remain open if triggered with a click or touch event.
     * @option
     * @example true
     */
    clickOpen: true,
    /**
     * Additional positioning classes, set by the JS
     * @option
     * @example 'top'
     */
    positionClass: '',
    /**
     * Distance, in pixels, the template should push away from the anchor on the Y axis.
     * @option
     * @example 10
     */
    vOffset: 10,
    /**
     * Distance, in pixels, the template should push away from the anchor on the X axis, if aligned to a side.
     * @option
     * @example 12
     */
    hOffset: 12,
    /**
    * Allow HTML in tooltip. Warning: If you are loading user-generated content into tooltips,
    * allowing HTML may open yourself up to XSS attacks.
    * @option
    * @example false
    */
    allowHtml: false
  };

  /**
   * TODO utilize resize event trigger
   */

  // Window exports
  Foundation.plugin(Tooltip, 'Tooltip');
}(jQuery);
;'use strict';

// Polyfill for requestAnimationFrame

(function () {
  if (!Date.now) Date.now = function () {
    return new Date().getTime();
  };

  var vendors = ['webkit', 'moz'];
  for (var i = 0; i < vendors.length && !window.requestAnimationFrame; ++i) {
    var vp = vendors[i];
    window.requestAnimationFrame = window[vp + 'RequestAnimationFrame'];
    window.cancelAnimationFrame = window[vp + 'CancelAnimationFrame'] || window[vp + 'CancelRequestAnimationFrame'];
  }
  if (/iP(ad|hone|od).*OS 6/.test(window.navigator.userAgent) || !window.requestAnimationFrame || !window.cancelAnimationFrame) {
    var lastTime = 0;
    window.requestAnimationFrame = function (callback) {
      var now = Date.now();
      var nextTime = Math.max(lastTime + 16, now);
      return setTimeout(function () {
        callback(lastTime = nextTime);
      }, nextTime - now);
    };
    window.cancelAnimationFrame = clearTimeout;
  }
})();

var initClasses = ['mui-enter', 'mui-leave'];
var activeClasses = ['mui-enter-active', 'mui-leave-active'];

// Find the right "transitionend" event for this browser
var endEvent = function () {
  var transitions = {
    'transition': 'transitionend',
    'WebkitTransition': 'webkitTransitionEnd',
    'MozTransition': 'transitionend',
    'OTransition': 'otransitionend'
  };
  var elem = window.document.createElement('div');

  for (var t in transitions) {
    if (typeof elem.style[t] !== 'undefined') {
      return transitions[t];
    }
  }

  return null;
}();

function animate(isIn, element, animation, cb) {
  element = $(element).eq(0);

  if (!element.length) return;

  if (endEvent === null) {
    isIn ? element.show() : element.hide();
    cb();
    return;
  }

  var initClass = isIn ? initClasses[0] : initClasses[1];
  var activeClass = isIn ? activeClasses[0] : activeClasses[1];

  // Set up the animation
  reset();
  element.addClass(animation);
  element.css('transition', 'none');
  requestAnimationFrame(function () {
    element.addClass(initClass);
    if (isIn) element.show();
  });

  // Start the animation
  requestAnimationFrame(function () {
    element[0].offsetWidth;
    element.css('transition', '');
    element.addClass(activeClass);
  });

  // Clean up the animation when it finishes
  element.one('transitionend', finish);

  // Hides the element (for out animations), resets the element, and runs a callback
  function finish() {
    if (!isIn) element.hide();
    reset();
    if (cb) cb.apply(element);
  }

  // Resets transitions and removes motion-specific classes
  function reset() {
    element[0].style.transitionDuration = 0;
    element.removeClass(initClass + ' ' + activeClass + ' ' + animation);
  }
}

var MotionUI = {
  animateIn: function (element, animation, cb) {
    animate(true, element, animation, cb);
  },

  animateOut: function (element, animation, cb) {
    animate(false, element, animation, cb);
  }
};
;$(function () {
  $(window).scroll(function () {

    $('.hideme').each(function (i) {

      var bottom_of_object = $(this).position().top + $(this).outerHeight();
      var bottom_of_window = $(window).scrollTop() + $(window).height();

      /* Adjust the "200" to either have a delay or that the content starts fading a bit before you reach it  */
      bottom_of_window = bottom_of_window + 500;

      if (bottom_of_window > bottom_of_object) {

        $(this).animate({ 'opacity': '1' }, 500);
      }
    });
  });
});

$(window).scroll(function () {

  /* animazione top menu */
  if ($(this).scrollTop() > 50) {
    $("#backtotop").css("opacity", " 1");
  } else {
    $("#backtotop").css("opacity", "0");
  }
});

/*Azione GoTop*/
function goto_top() {
  $('html, body').animate({
    scrollTop: 0
  }, 1500);
}

/* BACK TO TOP */
$("#backtotop a").click(function () {
  goto_top();
});

/*Roll-hover immagini winner*/

$(document).ready(function () {
  $('.single-event').hover(function () {

    $(this).find('.caption').fadeIn(350);
  }, function () {
    $(this).find('.caption').fadeOut(200);
  });
});

$(document).ready(function () {
  $('.single-event6').hover(function () {

    $(this).find('.caption').fadeIn(350);
  }, function () {
    $(this).find('.caption').fadeOut(200);
  });
});

/*Classe menu */
$(window).scroll(function () {
  if ($(this).scrollTop() > 100) {
    $(".is-stuck").addClass("smaller");
    /*$(".is-stuck").removeClass("bigger");*/
  } else {
    $(".is-stuck").removeClass("smaller");
    /*$(".top-bar").addClass("bigger");*/
  }
});

/*Grey imagine*/
$(window).scroll(function () {
  if ($(this).scrollTop() > 500) {
    $(".orbit-image").addClass("grey-on");
  } else {
    $("img.orbit-image").removeClass("grey-on");
  }
});
;

function initMap() {
  //var marker;

  // Create a new StyledMapType object, passing it an array of styles,
  // and the name to be displayed on the map type control.
  var styledMapType = new google.maps.StyledMapType(

  /*
      {elementType: 'geometry', stylers: [{color: '#000000'}]},
  {elementType: 'labels.text.fill', stylers: [{color: '#523735'}]},
  {elementType: 'labels.text.stroke', stylers: [{color: '#f5f1e6'}]},
      */
  [{
    "featureType": "administrative",
    "elementType": "geometry",
    "stylers": [{
      "color": "#804040"
    }]
  }, {
    "featureType": "administrative",
    "elementType": "geometry.fill",
    "stylers": [{
      "color": "#000040"
    }]
  }, {
    "featureType": "administrative",
    "elementType": "geometry.stroke",
    "stylers": [{
      "color": "#000040"
    }]
  }, {
    "featureType": "administrative.country",
    "elementType": "geometry.fill",
    "stylers": [{
      "color": "#800000"
    }, {
      "visibility": "on"
    }]
  }, {
    "featureType": "administrative.country",
    "elementType": "geometry.stroke",
    "stylers": [{
      "color": "#800000"
    }]
  }, {
    "featureType": "administrative.country",
    "elementType": "labels.text",
    "stylers": [{
      "color": "#808000"
    }, {
      "visibility": "simplified"
    }]
  }, {
    "featureType": "administrative.land_parcel",
    "elementType": "geometry.fill",
    "stylers": [{
      "visibility": "on"
    }]
  }, {
    "featureType": "administrative.land_parcel",
    "elementType": "geometry.stroke",
    "stylers": [{
      "visibility": "simplified"
    }]
  }, {
    "featureType": "administrative.locality",
    "stylers": [{
      "visibility": "off"
    }]
  }, {
    "featureType": "administrative.locality",
    "elementType": "geometry.fill",
    "stylers": [{
      "visibility": "on"
    }]
  }, {
    "featureType": "administrative.neighborhood",
    "elementType": "geometry.fill",
    "stylers": [{
      "visibility": "simplified"
    }]
  }, {
    "featureType": "landscape.man_made",
    "elementType": "geometry.fill",
    "stylers": [{
      "color": "#818285"
    }, {
      "saturation": 20
    }, {
      "lightness": 45
    }]
  }, {
    "featureType": "landscape.man_made",
    "elementType": "geometry.stroke",
    "stylers": [{
      "color": "#000000"
    }, {
      "visibility": "on"
    }]
  }, {
    "featureType": "landscape.man_made",
    "elementType": "labels.text.fill",
    "stylers": [{
      "saturation": 50
    }, {
      "lightness": -40
    }]
  }, {
    "featureType": "landscape.natural",
    "elementType": "geometry.stroke",
    "stylers": [{
      "color": "#408080"
    }]
  }, {
    "featureType": "landscape.natural.landcover",
    "elementType": "geometry.fill",
    "stylers": [{
      "saturation": -20
    }, {
      "lightness": 100
    }]
  }, {
    "featureType": "landscape.natural.terrain",
    "elementType": "geometry.fill",
    "stylers": [{
      "visibility": "simplified"
    }]
  }, {
    "featureType": "poi.park",
    "elementType": "geometry.fill",
    "stylers": [{
      "saturation": 35
    }, {
      "lightness": 35
    }]
  }, {
    "featureType": "poi.place_of_worship",
    "elementType": "geometry.fill",
    "stylers": [{
      "color": "#000000"
    }]
  }, {
    "featureType": "road.arterial",
    "elementType": "geometry.fill",
    "stylers": [{
      "color": "#cfb63a"
    }, {
      "saturation": 100
    }, {
      "lightness": 25
    }, {
      "weight": 2.5
    }]
  }, {
    "featureType": "road.arterial",
    "elementType": "geometry.stroke",
    "stylers": [{
      "color": "#cfb63a"
    }]
  }, {
    "featureType": "road.highway",
    "elementType": "geometry.fill",
    "stylers": [{
      "color": "#3c94c4"
    }, {
      "lightness": 45
    }]
  }, {
    "featureType": "road.highway.controlled_access",
    "elementType": "geometry.fill",
    "stylers": [{
      "color": "#ff8000"
    }]
  }, {
    "featureType": "road.local",
    "elementType": "geometry.fill",
    "stylers": [{
      "color": "#cfbb52"
    }, {
      "lightness": 5
    }, {
      "weight": 4
    }]
  }, {
    "featureType": "transit.station.bus",
    "elementType": "geometry",
    "stylers": [{
      "color": "#80ff00"
    }]
  }, {
    "featureType": "transit.station.bus",
    "elementType": "geometry.fill",
    "stylers": [{
      "color": "#000000"
    }]
  }, {
    "featureType": "transit.station.rail",
    "elementType": "geometry.fill",
    "stylers": [{
      "color": "#000000"
    }]
  }], { name: 'Styled Map' });

  var map = new google.maps.Map(document.getElementById('map'), {
    zoom: 19,
    center: { lat: 45.48108850000001, lng: 9.208886399999983 }
  });

  map.mapTypes.set('styled_map', styledMapType);
  map.setMapTypeId('styled_map');

  var image = 'http://www.artena.eu/test/wp-content/themes/FoundationPress/assets/images/marker.png';
  var beachMarker = new google.maps.Marker({
    position: { lat: 45.48108850000001, lng: 9.208886399999983 },
    map: map,
    icon: image
  });
  /* marker = new google.maps.Marker({
  	 map: map,
  	 draggable: false,
  	 animation: google.maps.Animation.DROP,
  	 title: 'Argentaria',
  	 position: {lat: 45.48108850000001, lng: 9.208886399999983}
  
  
   });
   marker.addListener('click', toggleBounce);*/
}

/*function toggleBounce() {
if (marker.getAnimation() !== null) {
marker.setAnimation(null);
} else {
marker.setAnimation(google.maps.Animation.BOUNCE);
}
}*/
;jQuery(document).foundation();
;// Joyride demo
jQuery('#start-jr').on('click', function () {
  jQuery(document).foundation('joyride', 'start');
});
;jQuery(document).ready(function () {
    var videos = jQuery('iframe[src*="vimeo.com"], iframe[src*="youtube.com"]');

    videos.each(function () {
        var el = jQuery(this);
        el.wrap('<div class="responsive-embed widescreen"/>');
    });
});
;
jQuery(window).bind(' load resize orientationChange ', function () {
   var footer = jQuery("#footer-container");
   var pos = footer.position();
   var height = jQuery(window).height();
   height = height - pos.top;
   height = height - footer.height() - 1;

   function stickyFooter() {
      footer.css({
         'margin-top': height + 'px'
      });
   }

   if (height > 0) {
      stickyFooter();
   }
});
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZvdW5kYXRpb24uY29yZS5qcyIsImZvdW5kYXRpb24udXRpbC5ib3guanMiLCJmb3VuZGF0aW9uLnV0aWwua2V5Ym9hcmQuanMiLCJmb3VuZGF0aW9uLnV0aWwubWVkaWFRdWVyeS5qcyIsImZvdW5kYXRpb24udXRpbC5tb3Rpb24uanMiLCJmb3VuZGF0aW9uLnV0aWwubmVzdC5qcyIsImZvdW5kYXRpb24udXRpbC50aW1lckFuZEltYWdlTG9hZGVyLmpzIiwiZm91bmRhdGlvbi51dGlsLnRvdWNoLmpzIiwiZm91bmRhdGlvbi51dGlsLnRyaWdnZXJzLmpzIiwiZm91bmRhdGlvbi5hYmlkZS5qcyIsImZvdW5kYXRpb24uYWNjb3JkaW9uLmpzIiwiZm91bmRhdGlvbi5hY2NvcmRpb25NZW51LmpzIiwiZm91bmRhdGlvbi5kcmlsbGRvd24uanMiLCJmb3VuZGF0aW9uLmRyb3Bkb3duLmpzIiwiZm91bmRhdGlvbi5kcm9wZG93bk1lbnUuanMiLCJmb3VuZGF0aW9uLmVxdWFsaXplci5qcyIsImZvdW5kYXRpb24uaW50ZXJjaGFuZ2UuanMiLCJmb3VuZGF0aW9uLm1hZ2VsbGFuLmpzIiwiZm91bmRhdGlvbi5vZmZjYW52YXMuanMiLCJmb3VuZGF0aW9uLm9yYml0LmpzIiwiZm91bmRhdGlvbi5yZXNwb25zaXZlTWVudS5qcyIsImZvdW5kYXRpb24ucmVzcG9uc2l2ZVRvZ2dsZS5qcyIsImZvdW5kYXRpb24ucmV2ZWFsLmpzIiwiZm91bmRhdGlvbi5zbGlkZXIuanMiLCJmb3VuZGF0aW9uLnN0aWNreS5qcyIsImZvdW5kYXRpb24udGFicy5qcyIsImZvdW5kYXRpb24udG9nZ2xlci5qcyIsImZvdW5kYXRpb24udG9vbHRpcC5qcyIsIm1vdGlvbi11aS5qcyIsImFydGVuYS5qcyIsImdvb2dsZS1tYXAuanMiLCJpbml0LWZvdW5kYXRpb24uanMiLCJqb3lyaWRlLWRlbW8uanMiLCJyZXNwb25zaXZlLXZpZGVvLmpzIiwic3RpY2t5Zm9vdGVyLmpzIl0sIm5hbWVzIjpbIiQiLCJGT1VOREFUSU9OX1ZFUlNJT04iLCJGb3VuZGF0aW9uIiwidmVyc2lvbiIsIl9wbHVnaW5zIiwiX3V1aWRzIiwicnRsIiwiYXR0ciIsInBsdWdpbiIsIm5hbWUiLCJjbGFzc05hbWUiLCJmdW5jdGlvbk5hbWUiLCJhdHRyTmFtZSIsImh5cGhlbmF0ZSIsInJlZ2lzdGVyUGx1Z2luIiwicGx1Z2luTmFtZSIsImNvbnN0cnVjdG9yIiwidG9Mb3dlckNhc2UiLCJ1dWlkIiwiR2V0WW9EaWdpdHMiLCIkZWxlbWVudCIsImRhdGEiLCJ0cmlnZ2VyIiwicHVzaCIsInVucmVnaXN0ZXJQbHVnaW4iLCJzcGxpY2UiLCJpbmRleE9mIiwicmVtb3ZlQXR0ciIsInJlbW92ZURhdGEiLCJwcm9wIiwicmVJbml0IiwicGx1Z2lucyIsImlzSlEiLCJlYWNoIiwiX2luaXQiLCJ0eXBlIiwiX3RoaXMiLCJmbnMiLCJwbGdzIiwiZm9yRWFjaCIsInAiLCJmb3VuZGF0aW9uIiwiT2JqZWN0Iiwia2V5cyIsImVyciIsImNvbnNvbGUiLCJlcnJvciIsImxlbmd0aCIsIm5hbWVzcGFjZSIsIk1hdGgiLCJyb3VuZCIsInBvdyIsInJhbmRvbSIsInRvU3RyaW5nIiwic2xpY2UiLCJyZWZsb3ciLCJlbGVtIiwiaSIsIiRlbGVtIiwiZmluZCIsImFkZEJhY2siLCIkZWwiLCJvcHRzIiwid2FybiIsInRoaW5nIiwic3BsaXQiLCJlIiwib3B0IiwibWFwIiwiZWwiLCJ0cmltIiwicGFyc2VWYWx1ZSIsImVyIiwiZ2V0Rm5OYW1lIiwidHJhbnNpdGlvbmVuZCIsInRyYW5zaXRpb25zIiwiZG9jdW1lbnQiLCJjcmVhdGVFbGVtZW50IiwiZW5kIiwidCIsInN0eWxlIiwic2V0VGltZW91dCIsInRyaWdnZXJIYW5kbGVyIiwidXRpbCIsInRocm90dGxlIiwiZnVuYyIsImRlbGF5IiwidGltZXIiLCJjb250ZXh0IiwiYXJncyIsImFyZ3VtZW50cyIsImFwcGx5IiwibWV0aG9kIiwiJG1ldGEiLCIkbm9KUyIsImFwcGVuZFRvIiwiaGVhZCIsInJlbW92ZUNsYXNzIiwiTWVkaWFRdWVyeSIsIkFycmF5IiwicHJvdG90eXBlIiwiY2FsbCIsInBsdWdDbGFzcyIsInVuZGVmaW5lZCIsIlJlZmVyZW5jZUVycm9yIiwiVHlwZUVycm9yIiwid2luZG93IiwiZm4iLCJEYXRlIiwibm93IiwiZ2V0VGltZSIsInZlbmRvcnMiLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJ2cCIsImNhbmNlbEFuaW1hdGlvbkZyYW1lIiwidGVzdCIsIm5hdmlnYXRvciIsInVzZXJBZ2VudCIsImxhc3RUaW1lIiwiY2FsbGJhY2siLCJuZXh0VGltZSIsIm1heCIsImNsZWFyVGltZW91dCIsInBlcmZvcm1hbmNlIiwic3RhcnQiLCJGdW5jdGlvbiIsImJpbmQiLCJvVGhpcyIsImFBcmdzIiwiZlRvQmluZCIsImZOT1AiLCJmQm91bmQiLCJjb25jYXQiLCJmdW5jTmFtZVJlZ2V4IiwicmVzdWx0cyIsImV4ZWMiLCJzdHIiLCJpc05hTiIsInBhcnNlRmxvYXQiLCJyZXBsYWNlIiwialF1ZXJ5IiwiQm94IiwiSW1Ob3RUb3VjaGluZ1lvdSIsIkdldERpbWVuc2lvbnMiLCJHZXRPZmZzZXRzIiwiZWxlbWVudCIsInBhcmVudCIsImxyT25seSIsInRiT25seSIsImVsZURpbXMiLCJ0b3AiLCJib3R0b20iLCJsZWZ0IiwicmlnaHQiLCJwYXJEaW1zIiwib2Zmc2V0IiwiaGVpZ2h0Iiwid2lkdGgiLCJ3aW5kb3dEaW1zIiwiYWxsRGlycyIsIkVycm9yIiwicmVjdCIsImdldEJvdW5kaW5nQ2xpZW50UmVjdCIsInBhclJlY3QiLCJwYXJlbnROb2RlIiwid2luUmVjdCIsImJvZHkiLCJ3aW5ZIiwicGFnZVlPZmZzZXQiLCJ3aW5YIiwicGFnZVhPZmZzZXQiLCJwYXJlbnREaW1zIiwiYW5jaG9yIiwicG9zaXRpb24iLCJ2T2Zmc2V0IiwiaE9mZnNldCIsImlzT3ZlcmZsb3ciLCIkZWxlRGltcyIsIiRhbmNob3JEaW1zIiwia2V5Q29kZXMiLCJjb21tYW5kcyIsIktleWJvYXJkIiwiZ2V0S2V5Q29kZXMiLCJwYXJzZUtleSIsImV2ZW50Iiwia2V5Iiwid2hpY2giLCJrZXlDb2RlIiwiU3RyaW5nIiwiZnJvbUNoYXJDb2RlIiwidG9VcHBlckNhc2UiLCJzaGlmdEtleSIsImN0cmxLZXkiLCJhbHRLZXkiLCJoYW5kbGVLZXkiLCJjb21wb25lbnQiLCJmdW5jdGlvbnMiLCJjb21tYW5kTGlzdCIsImNtZHMiLCJjb21tYW5kIiwibHRyIiwiZXh0ZW5kIiwicmV0dXJuVmFsdWUiLCJoYW5kbGVkIiwidW5oYW5kbGVkIiwiZmluZEZvY3VzYWJsZSIsImZpbHRlciIsImlzIiwicmVnaXN0ZXIiLCJjb21wb25lbnROYW1lIiwidHJhcEZvY3VzIiwiJGZvY3VzYWJsZSIsIiRmaXJzdEZvY3VzYWJsZSIsImVxIiwiJGxhc3RGb2N1c2FibGUiLCJvbiIsInRhcmdldCIsInByZXZlbnREZWZhdWx0IiwiZm9jdXMiLCJyZWxlYXNlRm9jdXMiLCJvZmYiLCJrY3MiLCJrIiwia2MiLCJkZWZhdWx0UXVlcmllcyIsImxhbmRzY2FwZSIsInBvcnRyYWl0IiwicmV0aW5hIiwicXVlcmllcyIsImN1cnJlbnQiLCJzZWxmIiwiZXh0cmFjdGVkU3R5bGVzIiwiY3NzIiwibmFtZWRRdWVyaWVzIiwicGFyc2VTdHlsZVRvT2JqZWN0IiwiaGFzT3duUHJvcGVydHkiLCJ2YWx1ZSIsIl9nZXRDdXJyZW50U2l6ZSIsIl93YXRjaGVyIiwiYXRMZWFzdCIsInNpemUiLCJxdWVyeSIsImdldCIsIm1hdGNoTWVkaWEiLCJtYXRjaGVzIiwibWF0Y2hlZCIsIm5ld1NpemUiLCJjdXJyZW50U2l6ZSIsInN0eWxlTWVkaWEiLCJtZWRpYSIsInNjcmlwdCIsImdldEVsZW1lbnRzQnlUYWdOYW1lIiwiaW5mbyIsImlkIiwiaW5zZXJ0QmVmb3JlIiwiZ2V0Q29tcHV0ZWRTdHlsZSIsImN1cnJlbnRTdHlsZSIsIm1hdGNoTWVkaXVtIiwidGV4dCIsInN0eWxlU2hlZXQiLCJjc3NUZXh0IiwidGV4dENvbnRlbnQiLCJzdHlsZU9iamVjdCIsInJlZHVjZSIsInJldCIsInBhcmFtIiwicGFydHMiLCJ2YWwiLCJkZWNvZGVVUklDb21wb25lbnQiLCJpc0FycmF5IiwiaW5pdENsYXNzZXMiLCJhY3RpdmVDbGFzc2VzIiwiTW90aW9uIiwiYW5pbWF0ZUluIiwiYW5pbWF0aW9uIiwiY2IiLCJhbmltYXRlIiwiYW5pbWF0ZU91dCIsIk1vdmUiLCJkdXJhdGlvbiIsImFuaW0iLCJwcm9nIiwibW92ZSIsInRzIiwiaXNJbiIsImluaXRDbGFzcyIsImFjdGl2ZUNsYXNzIiwicmVzZXQiLCJhZGRDbGFzcyIsInNob3ciLCJvZmZzZXRXaWR0aCIsIm9uZSIsImZpbmlzaCIsImhpZGUiLCJ0cmFuc2l0aW9uRHVyYXRpb24iLCJOZXN0IiwiRmVhdGhlciIsIm1lbnUiLCJpdGVtcyIsInN1Yk1lbnVDbGFzcyIsInN1Ykl0ZW1DbGFzcyIsImhhc1N1YkNsYXNzIiwiJGl0ZW0iLCIkc3ViIiwiY2hpbGRyZW4iLCJCdXJuIiwiVGltZXIiLCJvcHRpb25zIiwibmFtZVNwYWNlIiwicmVtYWluIiwiaXNQYXVzZWQiLCJyZXN0YXJ0IiwiaW5maW5pdGUiLCJwYXVzZSIsIm9uSW1hZ2VzTG9hZGVkIiwiaW1hZ2VzIiwidW5sb2FkZWQiLCJjb21wbGV0ZSIsInJlYWR5U3RhdGUiLCJzaW5nbGVJbWFnZUxvYWRlZCIsInNyYyIsInNwb3RTd2lwZSIsImVuYWJsZWQiLCJkb2N1bWVudEVsZW1lbnQiLCJtb3ZlVGhyZXNob2xkIiwidGltZVRocmVzaG9sZCIsInN0YXJ0UG9zWCIsInN0YXJ0UG9zWSIsInN0YXJ0VGltZSIsImVsYXBzZWRUaW1lIiwiaXNNb3ZpbmciLCJvblRvdWNoRW5kIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsIm9uVG91Y2hNb3ZlIiwieCIsInRvdWNoZXMiLCJwYWdlWCIsInkiLCJwYWdlWSIsImR4IiwiZHkiLCJkaXIiLCJhYnMiLCJvblRvdWNoU3RhcnQiLCJhZGRFdmVudExpc3RlbmVyIiwiaW5pdCIsInRlYXJkb3duIiwic3BlY2lhbCIsInN3aXBlIiwic2V0dXAiLCJub29wIiwiYWRkVG91Y2giLCJoYW5kbGVUb3VjaCIsImNoYW5nZWRUb3VjaGVzIiwiZmlyc3QiLCJldmVudFR5cGVzIiwidG91Y2hzdGFydCIsInRvdWNobW92ZSIsInRvdWNoZW5kIiwic2ltdWxhdGVkRXZlbnQiLCJNb3VzZUV2ZW50Iiwic2NyZWVuWCIsInNjcmVlblkiLCJjbGllbnRYIiwiY2xpZW50WSIsImNyZWF0ZUV2ZW50IiwiaW5pdE1vdXNlRXZlbnQiLCJkaXNwYXRjaEV2ZW50IiwiTXV0YXRpb25PYnNlcnZlciIsInByZWZpeGVzIiwidHJpZ2dlcnMiLCJzdG9wUHJvcGFnYXRpb24iLCJmYWRlT3V0IiwiY2hlY2tMaXN0ZW5lcnMiLCJldmVudHNMaXN0ZW5lciIsInJlc2l6ZUxpc3RlbmVyIiwic2Nyb2xsTGlzdGVuZXIiLCJtdXRhdGVMaXN0ZW5lciIsImNsb3NlbWVMaXN0ZW5lciIsInlldGlCb3hlcyIsInBsdWdOYW1lcyIsImxpc3RlbmVycyIsImpvaW4iLCJwbHVnaW5JZCIsIm5vdCIsImRlYm91bmNlIiwiJG5vZGVzIiwibm9kZXMiLCJxdWVyeVNlbGVjdG9yQWxsIiwibGlzdGVuaW5nRWxlbWVudHNNdXRhdGlvbiIsIm11dGF0aW9uUmVjb3Jkc0xpc3QiLCIkdGFyZ2V0IiwiYXR0cmlidXRlTmFtZSIsImNsb3Nlc3QiLCJlbGVtZW50T2JzZXJ2ZXIiLCJvYnNlcnZlIiwiYXR0cmlidXRlcyIsImNoaWxkTGlzdCIsImNoYXJhY3RlckRhdGEiLCJzdWJ0cmVlIiwiYXR0cmlidXRlRmlsdGVyIiwiSUhlYXJZb3UiLCJBYmlkZSIsImRlZmF1bHRzIiwiJGlucHV0cyIsIl9ldmVudHMiLCJyZXNldEZvcm0iLCJ2YWxpZGF0ZUZvcm0iLCJ2YWxpZGF0ZU9uIiwidmFsaWRhdGVJbnB1dCIsImxpdmVWYWxpZGF0ZSIsInZhbGlkYXRlT25CbHVyIiwiX3JlZmxvdyIsInJlcXVpcmVkQ2hlY2siLCJpc0dvb2QiLCJjaGVja2VkIiwiZmluZEZvcm1FcnJvciIsIiRlcnJvciIsInNpYmxpbmdzIiwiZm9ybUVycm9yU2VsZWN0b3IiLCJmaW5kTGFiZWwiLCIkbGFiZWwiLCJmaW5kUmFkaW9MYWJlbHMiLCIkZWxzIiwibGFiZWxzIiwiYWRkRXJyb3JDbGFzc2VzIiwiJGZvcm1FcnJvciIsImxhYmVsRXJyb3JDbGFzcyIsImZvcm1FcnJvckNsYXNzIiwiaW5wdXRFcnJvckNsYXNzIiwicmVtb3ZlUmFkaW9FcnJvckNsYXNzZXMiLCJncm91cE5hbWUiLCIkbGFiZWxzIiwiJGZvcm1FcnJvcnMiLCJyZW1vdmVFcnJvckNsYXNzZXMiLCJjbGVhclJlcXVpcmUiLCJ2YWxpZGF0ZWQiLCJjdXN0b21WYWxpZGF0b3IiLCJ2YWxpZGF0b3IiLCJlcXVhbFRvIiwidmFsaWRhdGVSYWRpbyIsInZhbGlkYXRlVGV4dCIsIm1hdGNoVmFsaWRhdGlvbiIsInZhbGlkYXRvcnMiLCJnb29kVG9HbyIsIm1lc3NhZ2UiLCJkZXBlbmRlbnRFbGVtZW50cyIsImFjYyIsIm5vRXJyb3IiLCJwYXR0ZXJuIiwiaW5wdXRUZXh0IiwidmFsaWQiLCJwYXR0ZXJucyIsIlJlZ0V4cCIsIiRncm91cCIsInJlcXVpcmVkIiwiY2xlYXIiLCJ2IiwiJGZvcm0iLCJkZXN0cm95IiwiYWxwaGEiLCJhbHBoYV9udW1lcmljIiwiaW50ZWdlciIsIm51bWJlciIsImNhcmQiLCJjdnYiLCJlbWFpbCIsInVybCIsImRvbWFpbiIsImRhdGV0aW1lIiwiZGF0ZSIsInRpbWUiLCJkYXRlSVNPIiwibW9udGhfZGF5X3llYXIiLCJkYXlfbW9udGhfeWVhciIsImNvbG9yIiwiQWNjb3JkaW9uIiwiJHRhYnMiLCJpZHgiLCIkY29udGVudCIsImxpbmtJZCIsIiRpbml0QWN0aXZlIiwiZG93biIsIiR0YWJDb250ZW50IiwidG9nZ2xlIiwibmV4dCIsIiRhIiwibXVsdGlFeHBhbmQiLCJwcmV2aW91cyIsInByZXYiLCJoYXNDbGFzcyIsInVwIiwiZmlyc3RUaW1lIiwiJGN1cnJlbnRBY3RpdmUiLCJzbGlkZURvd24iLCJzbGlkZVNwZWVkIiwiJGF1bnRzIiwiYWxsb3dBbGxDbG9zZWQiLCJzbGlkZVVwIiwic3RvcCIsIkFjY29yZGlvbk1lbnUiLCJtdWx0aU9wZW4iLCIkbWVudUxpbmtzIiwic3ViSWQiLCJpc0FjdGl2ZSIsImluaXRQYW5lcyIsIiRzdWJtZW51IiwiJGVsZW1lbnRzIiwiJHByZXZFbGVtZW50IiwiJG5leHRFbGVtZW50IiwibWluIiwicGFyZW50cyIsIm9wZW4iLCJjbG9zZSIsImNsb3NlQWxsIiwiaGlkZUFsbCIsInN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbiIsInNob3dBbGwiLCJwYXJlbnRzVW50aWwiLCJhZGQiLCIkbWVudXMiLCJEcmlsbGRvd24iLCIkc3VibWVudUFuY2hvcnMiLCIkc3VibWVudXMiLCIkbWVudUl0ZW1zIiwiX3ByZXBhcmVNZW51IiwiX3JlZ2lzdGVyRXZlbnRzIiwiX2tleWJvYXJkRXZlbnRzIiwiJGxpbmsiLCJwYXJlbnRMaW5rIiwiY2xvbmUiLCJwcmVwZW5kVG8iLCJ3cmFwIiwiJG1lbnUiLCIkYmFjayIsImJhY2tCdXR0b25Qb3NpdGlvbiIsImFwcGVuZCIsImJhY2tCdXR0b24iLCJwcmVwZW5kIiwiX2JhY2siLCJhdXRvSGVpZ2h0IiwiJHdyYXBwZXIiLCJ3cmFwcGVyIiwiYW5pbWF0ZUhlaWdodCIsIl9nZXRNYXhEaW1zIiwiX3Jlc2l6ZSIsIl9zaG93IiwiY2xvc2VPbkNsaWNrIiwiJGJvZHkiLCJjb250YWlucyIsIl9oaWRlQWxsIiwic2Nyb2xsVG9wIiwiX2JpbmRIYW5kbGVyIiwiX3Njcm9sbFRvcCIsIiRzY3JvbGxUb3BFbGVtZW50Iiwic2Nyb2xsVG9wRWxlbWVudCIsInNjcm9sbFBvcyIsInBhcnNlSW50Iiwic2Nyb2xsVG9wT2Zmc2V0IiwiYW5pbWF0aW9uRHVyYXRpb24iLCJhbmltYXRpb25FYXNpbmciLCJfaGlkZSIsInBhcmVudFN1Yk1lbnUiLCJfbWVudUxpbmtFdmVudHMiLCJibHVyIiwibWF4SGVpZ2h0IiwicmVzdWx0IiwibnVtT2ZFbGVtcyIsInVud3JhcCIsInJlbW92ZSIsIkRyb3Bkb3duIiwiJGlkIiwiJGFuY2hvciIsInBhcmVudENsYXNzIiwiJHBhcmVudCIsInBvc2l0aW9uQ2xhc3MiLCJnZXRQb3NpdGlvbkNsYXNzIiwiY291bnRlciIsInVzZWRQb3NpdGlvbnMiLCJ2ZXJ0aWNhbFBvc2l0aW9uIiwibWF0Y2giLCJob3Jpem9udGFsUG9zaXRpb24iLCJfcmVwb3NpdGlvbiIsImNsYXNzQ2hhbmdlZCIsIl9zZXRQb3NpdGlvbiIsImRpcmVjdGlvbiIsIm5ld1dpZHRoIiwicGFyZW50SE9mZnNldCIsIiRwYXJlbnREaW1zIiwiaG92ZXIiLCJib2R5RGF0YSIsIndoYXRpbnB1dCIsInRpbWVvdXQiLCJob3ZlckRlbGF5IiwiaG92ZXJQYW5lIiwidmlzaWJsZUZvY3VzYWJsZUVsZW1lbnRzIiwiX2FkZEJvZHlIYW5kbGVyIiwiYXV0b0ZvY3VzIiwiY3VyUG9zaXRpb25DbGFzcyIsIkRyb3Bkb3duTWVudSIsInN1YnMiLCJ2ZXJ0aWNhbENsYXNzIiwicmlnaHRDbGFzcyIsImFsaWdubWVudCIsImNoYW5nZWQiLCJfaXNWZXJ0aWNhbCIsImhhc1RvdWNoIiwib250b3VjaHN0YXJ0IiwicGFyQ2xhc3MiLCJoYW5kbGVDbGlja0ZuIiwiaGFzU3ViIiwiaGFzQ2xpY2tlZCIsImNsaWNrT3BlbiIsImZvcmNlRm9sbG93IiwiY2xvc2VPbkNsaWNrSW5zaWRlIiwiZGlzYWJsZUhvdmVyIiwiYXV0b2Nsb3NlIiwiY2xvc2luZ1RpbWUiLCJpc1RhYiIsImluZGV4IiwibmV4dFNpYmxpbmciLCJwcmV2U2libGluZyIsIm9wZW5TdWIiLCJjbG9zZVN1YiIsIiRzaWJzIiwib2xkQ2xhc3MiLCIkcGFyZW50TGkiLCIkdG9DbG9zZSIsInNvbWV0aGluZ1RvQ2xvc2UiLCJFcXVhbGl6ZXIiLCJlcUlkIiwiJHdhdGNoZWQiLCJoYXNOZXN0ZWQiLCJpc05lc3RlZCIsImlzT24iLCJvblJlc2l6ZU1lQm91bmQiLCJfb25SZXNpemVNZSIsIm9uUG9zdEVxdWFsaXplZEJvdW5kIiwiX29uUG9zdEVxdWFsaXplZCIsImltZ3MiLCJ0b29TbWFsbCIsImVxdWFsaXplT24iLCJfY2hlY2tNUSIsIl9wYXVzZUV2ZW50cyIsIl9raWxsc3dpdGNoIiwiZXF1YWxpemVPblN0YWNrIiwiX2lzU3RhY2tlZCIsImVxdWFsaXplQnlSb3ciLCJnZXRIZWlnaHRzQnlSb3ciLCJhcHBseUhlaWdodEJ5Um93IiwiZ2V0SGVpZ2h0cyIsImFwcGx5SGVpZ2h0IiwiaGVpZ2h0cyIsImxlbiIsIm9mZnNldEhlaWdodCIsImxhc3RFbFRvcE9mZnNldCIsImdyb3VwcyIsImdyb3VwIiwiZWxPZmZzZXRUb3AiLCJqIiwibG4iLCJncm91cHNJTGVuZ3RoIiwibGVuSiIsIkludGVyY2hhbmdlIiwicnVsZXMiLCJjdXJyZW50UGF0aCIsIl9hZGRCcmVha3BvaW50cyIsIl9nZW5lcmF0ZVJ1bGVzIiwicnVsZSIsInBhdGgiLCJTUEVDSUFMX1FVRVJJRVMiLCJydWxlc0xpc3QiLCJub2RlTmFtZSIsInJlc3BvbnNlIiwiaHRtbCIsIk1hZ2VsbGFuIiwiY2FsY1BvaW50cyIsIiR0YXJnZXRzIiwiJGxpbmtzIiwiJGFjdGl2ZSIsInBvaW50cyIsIndpbkhlaWdodCIsImlubmVySGVpZ2h0IiwiY2xpZW50SGVpZ2h0IiwiZG9jSGVpZ2h0Iiwic2Nyb2xsSGVpZ2h0IiwiJHRhciIsInB0IiwidGhyZXNob2xkIiwidGFyZ2V0UG9pbnQiLCJlYXNpbmciLCJkZWVwTGlua2luZyIsImxvY2F0aW9uIiwiaGFzaCIsInNjcm9sbFRvTG9jIiwiX3VwZGF0ZUFjdGl2ZSIsImFycml2YWwiLCJnZXRBdHRyaWJ1dGUiLCJsb2MiLCJfaW5UcmFuc2l0aW9uIiwiYmFyT2Zmc2V0Iiwid2luUG9zIiwiY3VySWR4IiwiaXNEb3duIiwiY3VyVmlzaWJsZSIsImhpc3RvcnkiLCJwdXNoU3RhdGUiLCJPZmZDYW52YXMiLCIkbGFzdFRyaWdnZXIiLCIkdHJpZ2dlcnMiLCJ0cmFuc2l0aW9uIiwiY29udGVudE92ZXJsYXkiLCJvdmVybGF5Iiwib3ZlcmxheVBvc2l0aW9uIiwic2V0QXR0cmlidXRlIiwiJG92ZXJsYXkiLCJpc1JldmVhbGVkIiwicmV2ZWFsQ2xhc3MiLCJyZXZlYWxPbiIsIl9zZXRNUUNoZWNrZXIiLCJ0cmFuc2l0aW9uVGltZSIsIl9oYW5kbGVLZXlib2FyZCIsInJldmVhbCIsIiRjbG9zZXIiLCJfc3RvcFNjcm9sbGluZyIsImZvcmNlVG8iLCJzY3JvbGxUbyIsImNvbnRlbnRTY3JvbGwiLCJPcmJpdCIsIl9yZXNldCIsImNvbnRhaW5lckNsYXNzIiwiJHNsaWRlcyIsInNsaWRlQ2xhc3MiLCIkaW1hZ2VzIiwiaW5pdEFjdGl2ZSIsInVzZU1VSSIsIl9wcmVwYXJlRm9yT3JiaXQiLCJidWxsZXRzIiwiX2xvYWRCdWxsZXRzIiwiYXV0b1BsYXkiLCJnZW9TeW5jIiwiYWNjZXNzaWJsZSIsIiRidWxsZXRzIiwiYm94T2ZCdWxsZXRzIiwidGltZXJEZWxheSIsImNoYW5nZVNsaWRlIiwiX3NldFdyYXBwZXJIZWlnaHQiLCJ0ZW1wIiwiX3NldFNsaWRlSGVpZ2h0IiwicGF1c2VPbkhvdmVyIiwibmF2QnV0dG9ucyIsIiRjb250cm9scyIsIm5leHRDbGFzcyIsInByZXZDbGFzcyIsIiRzbGlkZSIsIl91cGRhdGVCdWxsZXRzIiwiaXNMVFIiLCJjaG9zZW5TbGlkZSIsIiRjdXJTbGlkZSIsIiRmaXJzdFNsaWRlIiwiJGxhc3RTbGlkZSIsImxhc3QiLCJkaXJJbiIsImRpck91dCIsIiRuZXdTbGlkZSIsImluZmluaXRlV3JhcCIsIiRvbGRCdWxsZXQiLCJzcGFuIiwiZGV0YWNoIiwiJG5ld0J1bGxldCIsImFuaW1JbkZyb21SaWdodCIsImFuaW1PdXRUb1JpZ2h0IiwiYW5pbUluRnJvbUxlZnQiLCJhbmltT3V0VG9MZWZ0IiwiUmVzcG9uc2l2ZU1lbnUiLCJjdXJyZW50TXEiLCJjdXJyZW50UGx1Z2luIiwicnVsZXNUcmVlIiwicnVsZVNpemUiLCJydWxlUGx1Z2luIiwiTWVudVBsdWdpbnMiLCJpc0VtcHR5T2JqZWN0IiwiX2NoZWNrTWVkaWFRdWVyaWVzIiwibWF0Y2hlZE1xIiwiY3NzQ2xhc3MiLCJkcm9wZG93biIsImRyaWxsZG93biIsImFjY29yZGlvbiIsIlJlc3BvbnNpdmVUb2dnbGUiLCJ0YXJnZXRJRCIsIiR0YXJnZXRNZW51IiwiJHRvZ2dsZXIiLCJpbnB1dCIsImFuaW1hdGlvbkluIiwiYW5pbWF0aW9uT3V0IiwiX3VwZGF0ZSIsIl91cGRhdGVNcUhhbmRsZXIiLCJ0b2dnbGVNZW51IiwiaGlkZUZvciIsIlJldmVhbCIsImNhY2hlZCIsIm1xIiwiaXNNb2JpbGUiLCJtb2JpbGVTbmlmZiIsImZ1bGxTY3JlZW4iLCJfbWFrZU92ZXJsYXkiLCJkZWVwTGluayIsIl91cGRhdGVQb3NpdGlvbiIsIm91dGVyV2lkdGgiLCJvdXRlckhlaWdodCIsIm1hcmdpbiIsIl9oYW5kbGVTdGF0ZSIsIm11bHRpcGxlT3BlbmVkIiwiYWRkUmV2ZWFsT3BlbkNsYXNzZXMiLCJvcmlnaW5hbFNjcm9sbFBvcyIsImFmdGVyQW5pbWF0aW9uIiwiZm9jdXNhYmxlRWxlbWVudHMiLCJzaG93RGVsYXkiLCJfZXh0cmFIYW5kbGVycyIsImNsb3NlT25Fc2MiLCJmaW5pc2hVcCIsImhpZGVEZWxheSIsInJlc2V0T25DbG9zZSIsInJlcGxhY2VTdGF0ZSIsInRpdGxlIiwiaHJlZiIsImJ0bU9mZnNldFBjdCIsImlQaG9uZVNuaWZmIiwiYW5kcm9pZFNuaWZmIiwiU2xpZGVyIiwiaW5wdXRzIiwiaGFuZGxlcyIsIiRoYW5kbGUiLCIkaW5wdXQiLCIkZmlsbCIsInZlcnRpY2FsIiwiaXNEYmwiLCJkaXNhYmxlZCIsImRpc2FibGVkQ2xhc3MiLCJiaW5kaW5nIiwiX3NldEluaXRBdHRyIiwiZG91YmxlU2lkZWQiLCIkaGFuZGxlMiIsIiRpbnB1dDIiLCJzZXRIYW5kbGVzIiwiX3NldEhhbmRsZVBvcyIsIl9wY3RPZkJhciIsInBjdE9mQmFyIiwicGVyY2VudCIsInBvc2l0aW9uVmFsdWVGdW5jdGlvbiIsIl9sb2dUcmFuc2Zvcm0iLCJfcG93VHJhbnNmb3JtIiwidG9GaXhlZCIsIl92YWx1ZSIsImJhc2VMb2ciLCJub25MaW5lYXJCYXNlIiwiJGhuZGwiLCJub0ludmVydCIsImgyVmFsIiwic3RlcCIsImgxVmFsIiwidmVydCIsImhPclciLCJsT3JUIiwiaGFuZGxlRGltIiwiZWxlbURpbSIsInB4VG9Nb3ZlIiwibW92ZW1lbnQiLCJkZWNpbWFsIiwiX3NldFZhbHVlcyIsImlzTGVmdEhuZGwiLCJkaW0iLCJoYW5kbGVQY3QiLCJoYW5kbGVQb3MiLCJpbml0aWFsU3RhcnQiLCJtb3ZlVGltZSIsImNoYW5nZWREZWxheSIsImluaXRWYWwiLCJpbml0aWFsRW5kIiwiX2hhbmRsZUV2ZW50IiwiaGFzVmFsIiwiZXZlbnRPZmZzZXQiLCJoYWxmT2ZIYW5kbGUiLCJiYXJEaW0iLCJ3aW5kb3dTY3JvbGwiLCJzY3JvbGxMZWZ0IiwiZWxlbU9mZnNldCIsImV2ZW50RnJvbUJhciIsImJhclhZIiwib2Zmc2V0UGN0IiwiX2FkanVzdFZhbHVlIiwiZmlyc3RIbmRsUG9zIiwiYWJzUG9zaXRpb24iLCJzZWNuZEhuZGxQb3MiLCJkaXYiLCJwcmV2X3ZhbCIsIm5leHRfdmFsIiwiX2V2ZW50c0ZvckhhbmRsZSIsImN1ckhhbmRsZSIsImNsaWNrU2VsZWN0IiwiZHJhZ2dhYmxlIiwiY3VycmVudFRhcmdldCIsIl8kaGFuZGxlIiwib2xkVmFsdWUiLCJuZXdWYWx1ZSIsImRlY3JlYXNlIiwiaW5jcmVhc2UiLCJkZWNyZWFzZV9mYXN0IiwiaW5jcmVhc2VfZmFzdCIsImludmVydFZlcnRpY2FsIiwiZnJhYyIsIm51bSIsImNsaWNrUG9zIiwiYmFzZSIsImxvZyIsIlN0aWNreSIsIndhc1dyYXBwZWQiLCIkY29udGFpbmVyIiwiY29udGFpbmVyIiwid3JhcElubmVyIiwic3RpY2t5Q2xhc3MiLCJzY3JvbGxDb3VudCIsImNoZWNrRXZlcnkiLCJpc1N0dWNrIiwiY29udGFpbmVySGVpZ2h0IiwiZWxlbUhlaWdodCIsIl9wYXJzZVBvaW50cyIsIl9zZXRTaXplcyIsInNjcm9sbCIsIl9jYWxjIiwiX3JlbW92ZVN0aWNreSIsInRvcFBvaW50IiwicmV2ZXJzZSIsInRvcEFuY2hvciIsImJ0bSIsImJ0bUFuY2hvciIsInB0cyIsImJyZWFrcyIsInBsYWNlIiwiY2FuU3RpY2siLCJfcGF1c2VMaXN0ZW5lcnMiLCJjaGVja1NpemVzIiwiYm90dG9tUG9pbnQiLCJfc2V0U3RpY2t5Iiwic3RpY2tUbyIsIm1yZ24iLCJub3RTdHVja1RvIiwiaXNUb3AiLCJzdGlja1RvVG9wIiwiYW5jaG9yUHQiLCJhbmNob3JIZWlnaHQiLCJ0b3BPckJvdHRvbSIsInN0aWNreU9uIiwibmV3RWxlbVdpZHRoIiwiY29tcCIsInBkbmdsIiwicGRuZ3IiLCJuZXdDb250YWluZXJIZWlnaHQiLCJfc2V0QnJlYWtQb2ludHMiLCJtVG9wIiwiZW1DYWxjIiwibWFyZ2luVG9wIiwibUJ0bSIsIm1hcmdpbkJvdHRvbSIsImVtIiwiZm9udFNpemUiLCJUYWJzIiwiJHRhYlRpdGxlcyIsImxpbmtDbGFzcyIsImxpbmtBY3RpdmVDbGFzcyIsImxvYWQiLCJkZWVwTGlua1NtdWRnZURlbGF5Iiwic2VsZWN0VGFiIiwiZGVlcExpbmtTbXVkZ2UiLCJtYXRjaEhlaWdodCIsIl9zZXRIZWlnaHQiLCJfYWRkS2V5SGFuZGxlciIsIl9hZGRDbGlja0hhbmRsZXIiLCJfc2V0SGVpZ2h0TXFIYW5kbGVyIiwiX2hhbmRsZVRhYkNoYW5nZSIsIndyYXBPbktleXMiLCJhY3RpdmVDb2xsYXBzZSIsIl9jb2xsYXBzZVRhYiIsIiRvbGRUYWIiLCIkdGFiTGluayIsIiR0YXJnZXRDb250ZW50IiwiX29wZW5UYWIiLCJ1cGRhdGVIaXN0b3J5IiwicGFuZWxBY3RpdmVDbGFzcyIsIiR0YXJnZXRfYW5jaG9yIiwiaWRTdHIiLCJwYW5lbENsYXNzIiwicGFuZWwiLCJUb2dnbGVyIiwiX3RvZ2dsZUNsYXNzIiwidG9nZ2xlQ2xhc3MiLCJfdXBkYXRlQVJJQSIsIl90b2dnbGVBbmltYXRlIiwiVG9vbHRpcCIsImlzQ2xpY2siLCJlbGVtSWQiLCJfZ2V0UG9zaXRpb25DbGFzcyIsInRpcFRleHQiLCJ0ZW1wbGF0ZSIsIl9idWlsZFRlbXBsYXRlIiwiYWxsb3dIdG1sIiwidHJpZ2dlckNsYXNzIiwidGVtcGxhdGVDbGFzc2VzIiwidG9vbHRpcENsYXNzIiwiJHRlbXBsYXRlIiwiJHRpcERpbXMiLCJzaG93T24iLCJmYWRlSW4iLCJmYWRlSW5EdXJhdGlvbiIsImZhZGVPdXREdXJhdGlvbiIsImlzRm9jdXMiLCJkaXNhYmxlRm9yVG91Y2giLCJ0b3VjaENsb3NlVGV4dCIsImVuZEV2ZW50IiwiTW90aW9uVUkiLCJib3R0b21fb2Zfb2JqZWN0IiwiYm90dG9tX29mX3dpbmRvdyIsImdvdG9fdG9wIiwiY2xpY2siLCJyZWFkeSIsImluaXRNYXAiLCJzdHlsZWRNYXBUeXBlIiwiZ29vZ2xlIiwibWFwcyIsIlN0eWxlZE1hcFR5cGUiLCJNYXAiLCJnZXRFbGVtZW50QnlJZCIsInpvb20iLCJjZW50ZXIiLCJsYXQiLCJsbmciLCJtYXBUeXBlcyIsInNldCIsInNldE1hcFR5cGVJZCIsImltYWdlIiwiYmVhY2hNYXJrZXIiLCJNYXJrZXIiLCJpY29uIiwidmlkZW9zIiwiZm9vdGVyIiwicG9zIiwic3RpY2t5Rm9vdGVyIl0sIm1hcHBpbmdzIjoiQUFBQSxDQUFDLFVBQVNBLENBQVQsRUFBWTs7QUFFYjs7QUFFQSxNQUFJQyxxQkFBcUIsT0FBekI7O0FBRUE7QUFDQTtBQUNBLE1BQUlDLGFBQWE7QUFDZkMsYUFBU0Ysa0JBRE07O0FBR2Y7OztBQUdBRyxjQUFVLEVBTks7O0FBUWY7OztBQUdBQyxZQUFRLEVBWE87O0FBYWY7OztBQUdBQyxTQUFLLFlBQVU7QUFDYixhQUFPTixFQUFFLE1BQUYsRUFBVU8sSUFBVixDQUFlLEtBQWYsTUFBMEIsS0FBakM7QUFDRCxLQWxCYztBQW1CZjs7OztBQUlBQyxZQUFRLFVBQVNBLE1BQVQsRUFBaUJDLElBQWpCLEVBQXVCO0FBQzdCO0FBQ0E7QUFDQSxVQUFJQyxZQUFhRCxRQUFRRSxhQUFhSCxNQUFiLENBQXpCO0FBQ0E7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O0NDM1VBbjRCLE9BQU9oRSxRQUFQLEVBQWlCbkMsVUFBakI7RUNBQTtBQUNBbUcsT0FBTyxXQUFQLEVBQW9CMkUsRUFBcEIsQ0FBdUIsT0FBdkIsRUFBZ0MsWUFBVztBQUN6QzNFLFNBQU9oRSxRQUFQLEVBQWlCbkMsVUFBakIsQ0FBNEIsU0FBNUIsRUFBc0MsT0FBdEM7QUFDRCxDQUZEO0NDREFtRyxPQUFPaEUsUUFBUCxFQUFpQm83QixLQUFqQixDQUF1QixZQUFZO0FBQy9CLFFBQUltQixTQUFTdjRCLE9BQU8sc0RBQVAsQ0FBYjs7QUFFQXU0QixXQUFPbC9CLElBQVAsQ0FBWSxZQUFZO0FBQ3BCLFlBQUlvQyxLQUFLdUUsT0FBTyxJQUFQLENBQVQ7QUFDQXZFLFdBQUcrYyxJQUFILENBQVEsNENBQVI7QUFDSCxLQUhEO0FBSUgsQ0FQRDs7QUNDQXhZLE9BQU9sQyxNQUFQLEVBQWVvQixJQUFmLENBQW9CLGlDQUFwQixFQUF1RCxZQUFZO0FBQ2hFLE9BQUlzNUIsU0FBU3g0QixPQUFPLG1CQUFQLENBQWI7QUFDQSxPQUFJeTRCLE1BQU1ELE9BQU92MkIsUUFBUCxFQUFWO0FBQ0EsT0FBSWpCLFNBQVNoQixPQUFPbEMsTUFBUCxFQUFla0QsTUFBZixFQUFiO0FBQ0FBLFlBQVNBLFNBQVN5M0IsSUFBSS8zQixHQUF0QjtBQUNBTSxZQUFTQSxTQUFTdzNCLE9BQU94M0IsTUFBUCxFQUFULEdBQTBCLENBQW5DOztBQUVBLFlBQVMwM0IsWUFBVCxHQUF3QjtBQUN0QkYsYUFBTzV5QixHQUFQLENBQVc7QUFDUCx1QkFBYzVFLFNBQVM7QUFEaEIsT0FBWDtBQUdEOztBQUVELE9BQUlBLFNBQVMsQ0FBYixFQUFnQjtBQUNkMDNCO0FBQ0Q7QUFDSCxDQWhCRCIsImZpbGUiOiJmb3VuZGF0aW9uLmpzIiwic291cmNlc0NvbnRlbnQiOlsiIWZ1bmN0aW9uKCQpIHtcclxuXHJcblwidXNlIHN0cmljdFwiO1xyXG5cclxudmFyIEZPVU5EQVRJT05fVkVSU0lPTiA9ICc2LjMuMCc7XHJcblxyXG4vLyBHbG9iYWwgRm91bmRhdGlvbiBvYmplY3RcclxuLy8gVGhpcyBpcyBhdHRhY2hlZCB0byB0aGUgd2luZG93LCBvciB1c2VkIGFzIGEgbW9kdWxlIGZvciBBTUQvQnJvd3NlcmlmeVxyXG52YXIgRm91bmRhdGlvbiA9IHtcclxuICB2ZXJzaW9uOiBGT1VOREFUSU9OX1ZFUlNJT04sXHJcblxyXG4gIC8qKlxyXG4gICAqIFN0b3JlcyBpbml0aWFsaXplZCBwbHVnaW5zLlxyXG4gICAqL1xyXG4gIF9wbHVnaW5zOiB7fSxcclxuXHJcbiAgLyoqXHJcbiAgICogU3RvcmVzIGdlbmVyYXRlZCB1bmlxdWUgaWRzIGZvciBwbHVnaW4gaW5zdGFuY2VzXHJcbiAgICovXHJcbiAgX3V1aWRzOiBbXSxcclxuXHJcbiAgLyoqXHJcbiAgICogUmV0dXJucyBhIGJvb2xlYW4gZm9yIFJUTCBzdXBwb3J0XHJcbiAgICovXHJcbiAgcnRsOiBmdW5jdGlvbigpe1xyXG4gICAgcmV0dXJuICQoJ2h0bWwnKS5hdHRyKCdkaXInKSA9PT0gJ3J0bCc7XHJcbiAgfSxcclxuICAvKipcclxuICAgKiBEZWZpbmVzIGEgRm91bmRhdGlvbiBwbHVnaW4sIGFkZGluZyBpdCB0byB0aGUgYEZvdW5kYXRpb25gIG5hbWVzcGFjZSBhbmQgdGhlIGxpc3Qgb2YgcGx1Z2lucyB0byBpbml0aWFsaXplIHdoZW4gcmVmbG93aW5nLlxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBwbHVnaW4gLSBUaGUgY29uc3RydWN0b3Igb2YgdGhlIHBsdWdpbi5cclxuICAgKi9cclxuICBwbHVnaW46IGZ1bmN0aW9uKHBsdWdpbiwgbmFtZSkge1xyXG4gICAgLy8gT2JqZWN0IGtleSB0byB1c2Ugd2hlbiBhZGRpbmcgdG8gZ2xvYmFsIEZvdW5kYXRpb24gb2JqZWN0XHJcbiAgICAvLyBFeGFtcGxlczogRm91bmRhdGlvbi5SZXZlYWwsIEZvdW5kYXRpb24uT2ZmQ2FudmFzXHJcbiAgICB2YXIgY2xhc3NOYW1lID0gKG5hbWUgfHwgZnVuY3Rpb25OYW1lKHBsdWdpbikpO1xyXG4gICAgLy8gT2JqZWN0IGtleSB0byB1c2Ugd2hlbiBzdG9yaW5nIHRoZSBwbHVnaW4sIGFsc28gdXNlZCB0byBjcmVhdGUgdGhlIGlkZW50aWZ5aW5nIGRhdGEgYXR0cmlidXRlIGZvciB0aGUgcGx1Z2luXHJcbiAgICAvLyBFeGFtcGxlczogZGF0YS1yZXZlYWwsIGRhdGEtb2ZmLWNhbnZhc1xyXG4gICAgdmFyIGF0dHJOYW1lICA9IGh5cGhlbmF0ZShjbGFzc05hbWUpO1xyXG5cclxuICAgIC8vIEFkZCB0byB0aGUgRm91bmRhdGlvbiBvYmplY3QgYW5kIHRoZSBwbHVnaW5zIGxpc3QgKGZvciByZWZsb3dpbmcpXHJcbiAgICB0aGlzLl9wbHVnaW5zW2F0dHJOYW1lXSA9IHRoaXNbY2xhc3NOYW1lXSA9IHBsdWdpbjtcclxuICB9LFxyXG4gIC8qKlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIFBvcHVsYXRlcyB0aGUgX3V1aWRzIGFycmF5IHdpdGggcG9pbnRlcnMgdG8gZWFjaCBpbmRpdmlkdWFsIHBsdWdpbiBpbnN0YW5jZS5cclxuICAgKiBBZGRzIHRoZSBgemZQbHVnaW5gIGRhdGEtYXR0cmlidXRlIHRvIHByb2dyYW1tYXRpY2FsbHkgY3JlYXRlZCBwbHVnaW5zIHRvIGFsbG93IHVzZSBvZiAkKHNlbGVjdG9yKS5mb3VuZGF0aW9uKG1ldGhvZCkgY2FsbHMuXHJcbiAgICogQWxzbyBmaXJlcyB0aGUgaW5pdGlhbGl6YXRpb24gZXZlbnQgZm9yIGVhY2ggcGx1Z2luLCBjb25zb2xpZGF0aW5nIHJlcGV0aXRpdmUgY29kZS5cclxuICAgKiBAcGFyYW0ge09iamVjdH0gcGx1Z2luIC0gYW4gaW5zdGFuY2Ugb2YgYSBwbHVnaW4sIHVzdWFsbHkgYHRoaXNgIGluIGNvbnRleHQuXHJcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgLSB0aGUgbmFtZSBvZiB0aGUgcGx1Z2luLCBwYXNzZWQgYXMgYSBjYW1lbENhc2VkIHN0cmluZy5cclxuICAgKiBAZmlyZXMgUGx1Z2luI2luaXRcclxuICAgKi9cclxuICByZWdpc3RlclBsdWdpbjogZnVuY3Rpb24ocGx1Z2luLCBuYW1lKXtcclxuICAgIHZhciBwbHVnaW5OYW1lID0gbmFtZSA/IGh5cGhlbmF0ZShuYW1lKSA6IGZ1bmN0aW9uTmFtZShwbHVnaW4uY29uc3RydWN0b3IpLnRvTG93ZXJDYXNlKCk7XHJcbiAgICBwbHVnaW4udXVpZCA9IHRoaXMuR2V0WW9EaWdpdHMoNiwgcGx1Z2luTmFtZSk7XHJcblxyXG4gICAgaWYoIXBsdWdpbi4kZWxlbWVudC5hdHRyKGBkYXRhLSR7cGx1Z2luTmFtZX1gKSl7IHBsdWdpbi4kZWxlbWVudC5hdHRyKGBkYXRhLSR7cGx1Z2luTmFtZX1gLCBwbHVnaW4udXVpZCk7IH1cclxuICAgIGlmKCFwbHVnaW4uJGVsZW1lbnQuZGF0YSgnemZQbHVnaW4nKSl7IHBsdWdpbi4kZWxlbWVudC5kYXRhKCd6ZlBsdWdpbicsIHBsdWdpbik7IH1cclxuICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICogRmlyZXMgd2hlbiB0aGUgcGx1Z2luIGhhcyBpbml0aWFsaXplZC5cclxuICAgICAgICAgICAqIEBldmVudCBQbHVnaW4jaW5pdFxyXG4gICAgICAgICAgICovXHJcbiAgICBwbHVnaW4uJGVsZW1lbnQudHJpZ2dlcihgaW5pdC56Zi4ke3BsdWdpbk5hbWV9YCk7XHJcblxyXG4gICAgdGhpcy5fdXVpZHMucHVzaChwbHVnaW4udXVpZCk7XHJcblxyXG4gICAgcmV0dXJuO1xyXG4gIH0sXHJcbiAgLyoqXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogUmVtb3ZlcyB0aGUgcGx1Z2lucyB1dWlkIGZyb20gdGhlIF91dWlkcyBhcnJheS5cclxuICAgKiBSZW1vdmVzIHRoZSB6ZlBsdWdpbiBkYXRhIGF0dHJpYnV0ZSwgYXMgd2VsbCBhcyB0aGUgZGF0YS1wbHVnaW4tbmFtZSBhdHRyaWJ1dGUuXHJcbiAgICogQWxzbyBmaXJlcyB0aGUgZGVzdHJveWVkIGV2ZW50IGZvciB0aGUgcGx1Z2luLCBjb25zb2xpZGF0aW5nIHJlcGV0aXRpdmUgY29kZS5cclxuICAgKiBAcGFyYW0ge09iamVjdH0gcGx1Z2luIC0gYW4gaW5zdGFuY2Ugb2YgYSBwbHVnaW4sIHVzdWFsbHkgYHRoaXNgIGluIGNvbnRleHQuXHJcbiAgICogQGZpcmVzIFBsdWdpbiNkZXN0cm95ZWRcclxuICAgKi9cclxuICB1bnJlZ2lzdGVyUGx1Z2luOiBmdW5jdGlvbihwbHVnaW4pe1xyXG4gICAgdmFyIHBsdWdpbk5hbWUgPSBoeXBoZW5hdGUoZnVuY3Rpb25OYW1lKHBsdWdpbi4kZWxlbWVudC5kYXRhKCd6ZlBsdWdpbicpLmNvbnN0cnVjdG9yKSk7XHJcblxyXG4gICAgdGhpcy5fdXVpZHMuc3BsaWNlKHRoaXMuX3V1aWRzLmluZGV4T2YocGx1Z2luLnV1aWQpLCAxKTtcclxuICAgIHBsdWdpbi4kZWxlbWVudC5yZW1vdmVBdHRyKGBkYXRhLSR7cGx1Z2luTmFtZX1gKS5yZW1vdmVEYXRhKCd6ZlBsdWdpbicpXHJcbiAgICAgICAgICAvKipcclxuICAgICAgICAgICAqIEZpcmVzIHdoZW4gdGhlIHBsdWdpbiBoYXMgYmVlbiBkZXN0cm95ZWQuXHJcbiAgICAgICAgICAgKiBAZXZlbnQgUGx1Z2luI2Rlc3Ryb3llZFxyXG4gICAgICAgICAgICovXHJcbiAgICAgICAgICAudHJpZ2dlcihgZGVzdHJveWVkLnpmLiR7cGx1Z2luTmFtZX1gKTtcclxuICAgIGZvcih2YXIgcHJvcCBpbiBwbHVnaW4pe1xyXG4gICAgICBwbHVnaW5bcHJvcF0gPSBudWxsOy8vY2xlYW4gdXAgc2NyaXB0IHRvIHByZXAgZm9yIGdhcmJhZ2UgY29sbGVjdGlvbi5cclxuICAgIH1cclxuICAgIHJldHVybjtcclxuICB9LFxyXG5cclxuICAvKipcclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBDYXVzZXMgb25lIG9yIG1vcmUgYWN0aXZlIHBsdWdpbnMgdG8gcmUtaW5pdGlhbGl6ZSwgcmVzZXR0aW5nIGV2ZW50IGxpc3RlbmVycywgcmVjYWxjdWxhdGluZyBwb3NpdGlvbnMsIGV0Yy5cclxuICAgKiBAcGFyYW0ge1N0cmluZ30gcGx1Z2lucyAtIG9wdGlvbmFsIHN0cmluZyBvZiBhbiBpbmRpdmlkdWFsIHBsdWdpbiBrZXksIGF0dGFpbmVkIGJ5IGNhbGxpbmcgYCQoZWxlbWVudCkuZGF0YSgncGx1Z2luTmFtZScpYCwgb3Igc3RyaW5nIG9mIGEgcGx1Z2luIGNsYXNzIGkuZS4gYCdkcm9wZG93bidgXHJcbiAgICogQGRlZmF1bHQgSWYgbm8gYXJndW1lbnQgaXMgcGFzc2VkLCByZWZsb3cgYWxsIGN1cnJlbnRseSBhY3RpdmUgcGx1Z2lucy5cclxuICAgKi9cclxuICAgcmVJbml0OiBmdW5jdGlvbihwbHVnaW5zKXtcclxuICAgICB2YXIgaXNKUSA9IHBsdWdpbnMgaW5zdGFuY2VvZiAkO1xyXG4gICAgIHRyeXtcclxuICAgICAgIGlmKGlzSlEpe1xyXG4gICAgICAgICBwbHVnaW5zLmVhY2goZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAkKHRoaXMpLmRhdGEoJ3pmUGx1Z2luJykuX2luaXQoKTtcclxuICAgICAgICAgfSk7XHJcbiAgICAgICB9ZWxzZXtcclxuICAgICAgICAgdmFyIHR5cGUgPSB0eXBlb2YgcGx1Z2lucyxcclxuICAgICAgICAgX3RoaXMgPSB0aGlzLFxyXG4gICAgICAgICBmbnMgPSB7XHJcbiAgICAgICAgICAgJ29iamVjdCc6IGZ1bmN0aW9uKHBsZ3Mpe1xyXG4gICAgICAgICAgICAgcGxncy5mb3JFYWNoKGZ1bmN0aW9uKHApe1xyXG4gICAgICAgICAgICAgICBwID0gaHlwaGVuYXRlKHApO1xyXG4gICAgICAgICAgICAgICAkKCdbZGF0YS0nKyBwICsnXScpLmZvdW5kYXRpb24oJ19pbml0Jyk7XHJcbiAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICdzdHJpbmcnOiBmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICAgcGx1Z2lucyA9IGh5cGhlbmF0ZShwbHVnaW5zKTtcclxuICAgICAgICAgICAgICQoJ1tkYXRhLScrIHBsdWdpbnMgKyddJykuZm91bmRhdGlvbignX2luaXQnKTtcclxuICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICd1bmRlZmluZWQnOiBmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICAgdGhpc1snb2JqZWN0J10oT2JqZWN0LmtleXMoX3RoaXMuX3BsdWdpbnMpKTtcclxuICAgICAgICAgICB9XHJcbiAgICAgICAgIH07XHJcbiAgICAgICAgIGZuc1t0eXBlXShwbHVnaW5zKTtcclxuICAgICAgIH1cclxuICAgICB9Y2F0Y2goZXJyKXtcclxuICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTtcclxuICAgICB9ZmluYWxseXtcclxuICAgICAgIHJldHVybiBwbHVnaW5zO1xyXG4gICAgIH1cclxuICAgfSxcclxuXHJcbiAgLyoqXHJcbiAgICogcmV0dXJucyBhIHJhbmRvbSBiYXNlLTM2IHVpZCB3aXRoIG5hbWVzcGFjaW5nXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGxlbmd0aCAtIG51bWJlciBvZiByYW5kb20gYmFzZS0zNiBkaWdpdHMgZGVzaXJlZC4gSW5jcmVhc2UgZm9yIG1vcmUgcmFuZG9tIHN0cmluZ3MuXHJcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWVzcGFjZSAtIG5hbWUgb2YgcGx1Z2luIHRvIGJlIGluY29ycG9yYXRlZCBpbiB1aWQsIG9wdGlvbmFsLlxyXG4gICAqIEBkZWZhdWx0IHtTdHJpbmd9ICcnIC0gaWYgbm8gcGx1Z2luIG5hbWUgaXMgcHJvdmlkZWQsIG5vdGhpbmcgaXMgYXBwZW5kZWQgdG8gdGhlIHVpZC5cclxuICAgKiBAcmV0dXJucyB7U3RyaW5nfSAtIHVuaXF1ZSBpZFxyXG4gICAqL1xyXG4gIEdldFlvRGlnaXRzOiBmdW5jdGlvbihsZW5ndGgsIG5hbWVzcGFjZSl7XHJcbiAgICBsZW5ndGggPSBsZW5ndGggfHwgNjtcclxuICAgIHJldHVybiBNYXRoLnJvdW5kKChNYXRoLnBvdygzNiwgbGVuZ3RoICsgMSkgLSBNYXRoLnJhbmRvbSgpICogTWF0aC5wb3coMzYsIGxlbmd0aCkpKS50b1N0cmluZygzNikuc2xpY2UoMSkgKyAobmFtZXNwYWNlID8gYC0ke25hbWVzcGFjZX1gIDogJycpO1xyXG4gIH0sXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbGl6ZSBwbHVnaW5zIG9uIGFueSBlbGVtZW50cyB3aXRoaW4gYGVsZW1gIChhbmQgYGVsZW1gIGl0c2VsZikgdGhhdCBhcmVuJ3QgYWxyZWFkeSBpbml0aWFsaXplZC5cclxuICAgKiBAcGFyYW0ge09iamVjdH0gZWxlbSAtIGpRdWVyeSBvYmplY3QgY29udGFpbmluZyB0aGUgZWxlbWVudCB0byBjaGVjayBpbnNpZGUuIEFsc28gY2hlY2tzIHRoZSBlbGVtZW50IGl0c2VsZiwgdW5sZXNzIGl0J3MgdGhlIGBkb2N1bWVudGAgb2JqZWN0LlxyXG4gICAqIEBwYXJhbSB7U3RyaW5nfEFycmF5fSBwbHVnaW5zIC0gQSBsaXN0IG9mIHBsdWdpbnMgdG8gaW5pdGlhbGl6ZS4gTGVhdmUgdGhpcyBvdXQgdG8gaW5pdGlhbGl6ZSBldmVyeXRoaW5nLlxyXG4gICAqL1xyXG4gIHJlZmxvdzogZnVuY3Rpb24oZWxlbSwgcGx1Z2lucykge1xyXG5cclxuICAgIC8vIElmIHBsdWdpbnMgaXMgdW5kZWZpbmVkLCBqdXN0IGdyYWIgZXZlcnl0aGluZ1xyXG4gICAgaWYgKHR5cGVvZiBwbHVnaW5zID09PSAndW5kZWZpbmVkJykge1xyXG4gICAgICBwbHVnaW5zID0gT2JqZWN0LmtleXModGhpcy5fcGx1Z2lucyk7XHJcbiAgICB9XHJcbiAgICAvLyBJZiBwbHVnaW5zIGlzIGEgc3RyaW5nLCBjb252ZXJ0IGl0IHRvIGFuIGFycmF5IHdpdGggb25lIGl0ZW1cclxuICAgIGVsc2UgaWYgKHR5cGVvZiBwbHVnaW5zID09PSAnc3RyaW5nJykge1xyXG4gICAgICBwbHVnaW5zID0gW3BsdWdpbnNdO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcblxyXG4gICAgLy8gSXRlcmF0ZSB0aHJvdWdoIGVhY2ggcGx1Z2luXHJcbiAgICAkLmVhY2gocGx1Z2lucywgZnVuY3Rpb24oaSwgbmFtZSkge1xyXG4gICAgICAvLyBHZXQgdGhlIGN1cnJlbnQgcGx1Z2luXHJcbiAgICAgIHZhciBwbHVnaW4gPSBfdGhpcy5fcGx1Z2luc1tuYW1lXTtcclxuXHJcbiAgICAgIC8vIExvY2FsaXplIHRoZSBzZWFyY2ggdG8gYWxsIGVsZW1lbnRzIGluc2lkZSBlbGVtLCBhcyB3ZWxsIGFzIGVsZW0gaXRzZWxmLCB1bmxlc3MgZWxlbSA9PT0gZG9jdW1lbnRcclxuICAgICAgdmFyICRlbGVtID0gJChlbGVtKS5maW5kKCdbZGF0YS0nK25hbWUrJ10nKS5hZGRCYWNrKCdbZGF0YS0nK25hbWUrJ10nKTtcclxuXHJcbiAgICAgIC8vIEZvciBlYWNoIHBsdWdpbiBmb3VuZCwgaW5pdGlhbGl6ZSBpdFxyXG4gICAgICAkZWxlbS5lYWNoKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHZhciAkZWwgPSAkKHRoaXMpLFxyXG4gICAgICAgICAgICBvcHRzID0ge307XHJcbiAgICAgICAgLy8gRG9uJ3QgZG91YmxlLWRpcCBvbiBwbHVnaW5zXHJcbiAgICAgICAgaWYgKCRlbC5kYXRhKCd6ZlBsdWdpbicpKSB7XHJcbiAgICAgICAgICBjb25zb2xlLndhcm4oXCJUcmllZCB0byBpbml0aWFsaXplIFwiK25hbWUrXCIgb24gYW4gZWxlbWVudCB0aGF0IGFscmVhZHkgaGFzIGEgRm91bmRhdGlvbiBwbHVnaW4uXCIpO1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYoJGVsLmF0dHIoJ2RhdGEtb3B0aW9ucycpKXtcclxuICAgICAgICAgIHZhciB0aGluZyA9ICRlbC5hdHRyKCdkYXRhLW9wdGlvbnMnKS5zcGxpdCgnOycpLmZvckVhY2goZnVuY3Rpb24oZSwgaSl7XHJcbiAgICAgICAgICAgIHZhciBvcHQgPSBlLnNwbGl0KCc6JykubWFwKGZ1bmN0aW9uKGVsKXsgcmV0dXJuIGVsLnRyaW0oKTsgfSk7XHJcbiAgICAgICAgICAgIGlmKG9wdFswXSkgb3B0c1tvcHRbMF1dID0gcGFyc2VWYWx1ZShvcHRbMV0pO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRyeXtcclxuICAgICAgICAgICRlbC5kYXRhKCd6ZlBsdWdpbicsIG5ldyBwbHVnaW4oJCh0aGlzKSwgb3B0cykpO1xyXG4gICAgICAgIH1jYXRjaChlcil7XHJcbiAgICAgICAgICBjb25zb2xlLmVycm9yKGVyKTtcclxuICAgICAgICB9ZmluYWxseXtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfSxcclxuICBnZXRGbk5hbWU6IGZ1bmN0aW9uTmFtZSxcclxuICB0cmFuc2l0aW9uZW5kOiBmdW5jdGlvbigkZWxlbSl7XHJcbiAgICB2YXIgdHJhbnNpdGlvbnMgPSB7XHJcbiAgICAgICd0cmFuc2l0aW9uJzogJ3RyYW5zaXRpb25lbmQnLFxyXG4gICAgICAnV2Via2l0VHJhbnNpdGlvbic6ICd3ZWJraXRUcmFuc2l0aW9uRW5kJyxcclxuICAgICAgJ01velRyYW5zaXRpb24nOiAndHJhbnNpdGlvbmVuZCcsXHJcbiAgICAgICdPVHJhbnNpdGlvbic6ICdvdHJhbnNpdGlvbmVuZCdcclxuICAgIH07XHJcbiAgICB2YXIgZWxlbSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpLFxyXG4gICAgICAgIGVuZDtcclxuXHJcbiAgICBmb3IgKHZhciB0IGluIHRyYW5zaXRpb25zKXtcclxuICAgICAgaWYgKHR5cGVvZiBlbGVtLnN0eWxlW3RdICE9PSAndW5kZWZpbmVkJyl7XHJcbiAgICAgICAgZW5kID0gdHJhbnNpdGlvbnNbdF07XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIGlmKGVuZCl7XHJcbiAgICAgIHJldHVybiBlbmQ7XHJcbiAgICB9ZWxzZXtcclxuICAgICAgZW5kID0gc2V0VGltZW91dChmdW5jdGlvbigpe1xyXG4gICAgICAgICRlbGVtLnRyaWdnZXJIYW5kbGVyKCd0cmFuc2l0aW9uZW5kJywgWyRlbGVtXSk7XHJcbiAgICAgIH0sIDEpO1xyXG4gICAgICByZXR1cm4gJ3RyYW5zaXRpb25lbmQnO1xyXG4gICAgfVxyXG4gIH1cclxufTtcclxuXHJcbkZvdW5kYXRpb24udXRpbCA9IHtcclxuICAvKipcclxuICAgKiBGdW5jdGlvbiBmb3IgYXBwbHlpbmcgYSBkZWJvdW5jZSBlZmZlY3QgdG8gYSBmdW5jdGlvbiBjYWxsLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgLSBGdW5jdGlvbiB0byBiZSBjYWxsZWQgYXQgZW5kIG9mIHRpbWVvdXQuXHJcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGRlbGF5IC0gVGltZSBpbiBtcyB0byBkZWxheSB0aGUgY2FsbCBvZiBgZnVuY2AuXHJcbiAgICogQHJldHVybnMgZnVuY3Rpb25cclxuICAgKi9cclxuICB0aHJvdHRsZTogZnVuY3Rpb24gKGZ1bmMsIGRlbGF5KSB7XHJcbiAgICB2YXIgdGltZXIgPSBudWxsO1xyXG5cclxuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgIHZhciBjb250ZXh0ID0gdGhpcywgYXJncyA9IGFyZ3VtZW50cztcclxuXHJcbiAgICAgIGlmICh0aW1lciA9PT0gbnVsbCkge1xyXG4gICAgICAgIHRpbWVyID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xyXG4gICAgICAgICAgdGltZXIgPSBudWxsO1xyXG4gICAgICAgIH0sIGRlbGF5KTtcclxuICAgICAgfVxyXG4gICAgfTtcclxuICB9XHJcbn07XHJcblxyXG4vLyBUT0RPOiBjb25zaWRlciBub3QgbWFraW5nIHRoaXMgYSBqUXVlcnkgZnVuY3Rpb25cclxuLy8gVE9ETzogbmVlZCB3YXkgdG8gcmVmbG93IHZzLiByZS1pbml0aWFsaXplXHJcbi8qKlxyXG4gKiBUaGUgRm91bmRhdGlvbiBqUXVlcnkgbWV0aG9kLlxyXG4gKiBAcGFyYW0ge1N0cmluZ3xBcnJheX0gbWV0aG9kIC0gQW4gYWN0aW9uIHRvIHBlcmZvcm0gb24gdGhlIGN1cnJlbnQgalF1ZXJ5IG9iamVjdC5cclxuICovXHJcbnZhciBmb3VuZGF0aW9uID0gZnVuY3Rpb24obWV0aG9kKSB7XHJcbiAgdmFyIHR5cGUgPSB0eXBlb2YgbWV0aG9kLFxyXG4gICAgICAkbWV0YSA9ICQoJ21ldGEuZm91bmRhdGlvbi1tcScpLFxyXG4gICAgICAkbm9KUyA9ICQoJy5uby1qcycpO1xyXG5cclxuICBpZighJG1ldGEubGVuZ3RoKXtcclxuICAgICQoJzxtZXRhIGNsYXNzPVwiZm91bmRhdGlvbi1tcVwiPicpLmFwcGVuZFRvKGRvY3VtZW50LmhlYWQpO1xyXG4gIH1cclxuICBpZigkbm9KUy5sZW5ndGgpe1xyXG4gICAgJG5vSlMucmVtb3ZlQ2xhc3MoJ25vLWpzJyk7XHJcbiAgfVxyXG5cclxuICBpZih0eXBlID09PSAndW5kZWZpbmVkJyl7Ly9uZWVkcyB0byBpbml0aWFsaXplIHRoZSBGb3VuZGF0aW9uIG9iamVjdCwgb3IgYW4gaW5kaXZpZHVhbCBwbHVnaW4uXHJcbiAgICBGb3VuZGF0aW9uLk1lZGlhUXVlcnkuX2luaXQoKTtcclxuICAgIEZvdW5kYXRpb24ucmVmbG93KHRoaXMpO1xyXG4gIH1lbHNlIGlmKHR5cGUgPT09ICdzdHJpbmcnKXsvL2FuIGluZGl2aWR1YWwgbWV0aG9kIHRvIGludm9rZSBvbiBhIHBsdWdpbiBvciBncm91cCBvZiBwbHVnaW5zXHJcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7Ly9jb2xsZWN0IGFsbCB0aGUgYXJndW1lbnRzLCBpZiBuZWNlc3NhcnlcclxuICAgIHZhciBwbHVnQ2xhc3MgPSB0aGlzLmRhdGEoJ3pmUGx1Z2luJyk7Ly9kZXRlcm1pbmUgdGhlIGNsYXNzIG9mIHBsdWdpblxyXG5cclxuICAgIGlmKHBsdWdDbGFzcyAhPT0gdW5kZWZpbmVkICYmIHBsdWdDbGFzc1ttZXRob2RdICE9PSB1bmRlZmluZWQpey8vbWFrZSBzdXJlIGJvdGggdGhlIGNsYXNzIGFuZCBtZXRob2QgZXhpc3RcclxuICAgICAgaWYodGhpcy5sZW5ndGggPT09IDEpey8vaWYgdGhlcmUncyBvbmx5IG9uZSwgY2FsbCBpdCBkaXJlY3RseS5cclxuICAgICAgICAgIHBsdWdDbGFzc1ttZXRob2RdLmFwcGx5KHBsdWdDbGFzcywgYXJncyk7XHJcbiAgICAgIH1lbHNle1xyXG4gICAgICAgIHRoaXMuZWFjaChmdW5jdGlvbihpLCBlbCl7Ly9vdGhlcndpc2UgbG9vcCB0aHJvdWdoIHRoZSBqUXVlcnkgY29sbGVjdGlvbiBhbmQgaW52b2tlIHRoZSBtZXRob2Qgb24gZWFjaFxyXG4gICAgICAgICAgcGx1Z0NsYXNzW21ldGhvZF0uYXBwbHkoJChlbCkuZGF0YSgnemZQbHVnaW4nKSwgYXJncyk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgIH1lbHNley8vZXJyb3IgZm9yIG5vIGNsYXNzIG9yIG5vIG1ldGhvZFxyXG4gICAgICB0aHJvdyBuZXcgUmVmZXJlbmNlRXJyb3IoXCJXZSdyZSBzb3JyeSwgJ1wiICsgbWV0aG9kICsgXCInIGlzIG5vdCBhbiBhdmFpbGFibGUgbWV0aG9kIGZvciBcIiArIChwbHVnQ2xhc3MgPyBmdW5jdGlvbk5hbWUocGx1Z0NsYXNzKSA6ICd0aGlzIGVsZW1lbnQnKSArICcuJyk7XHJcbiAgICB9XHJcbiAgfWVsc2V7Ly9lcnJvciBmb3IgaW52YWxpZCBhcmd1bWVudCB0eXBlXHJcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBXZSdyZSBzb3JyeSwgJHt0eXBlfSBpcyBub3QgYSB2YWxpZCBwYXJhbWV0ZXIuIFlvdSBtdXN0IHVzZSBhIHN0cmluZyByZXByZXNlbnRpbmcgdGhlIG1ldGhvZCB5b3Ugd2lzaCB0byBpbnZva2UuYCk7XHJcbiAgfVxyXG4gIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxud2luZG93LkZvdW5kYXRpb24gPSBGb3VuZGF0aW9uO1xyXG4kLmZuLmZvdW5kYXRpb24gPSBmb3VuZGF0aW9uO1xyXG5cclxuLy8gUG9seWZpbGwgZm9yIHJlcXVlc3RBbmltYXRpb25GcmFtZVxyXG4oZnVuY3Rpb24oKSB7XHJcbiAgaWYgKCFEYXRlLm5vdyB8fCAhd2luZG93LkRhdGUubm93KVxyXG4gICAgd2luZG93LkRhdGUubm93ID0gRGF0ZS5ub3cgPSBmdW5jdGlvbigpIHsgcmV0dXJuIG5ldyBEYXRlKCkuZ2V0VGltZSgpOyB9O1xyXG5cclxuICB2YXIgdmVuZG9ycyA9IFsnd2Via2l0JywgJ21veiddO1xyXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdmVuZG9ycy5sZW5ndGggJiYgIXdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWU7ICsraSkge1xyXG4gICAgICB2YXIgdnAgPSB2ZW5kb3JzW2ldO1xyXG4gICAgICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gd2luZG93W3ZwKydSZXF1ZXN0QW5pbWF0aW9uRnJhbWUnXTtcclxuICAgICAgd2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lID0gKHdpbmRvd1t2cCsnQ2FuY2VsQW5pbWF0aW9uRnJhbWUnXVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8fCB3aW5kb3dbdnArJ0NhbmNlbFJlcXVlc3RBbmltYXRpb25GcmFtZSddKTtcclxuICB9XHJcbiAgaWYgKC9pUChhZHxob25lfG9kKS4qT1MgNi8udGVzdCh3aW5kb3cubmF2aWdhdG9yLnVzZXJBZ2VudClcclxuICAgIHx8ICF3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8ICF3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUpIHtcclxuICAgIHZhciBsYXN0VGltZSA9IDA7XHJcbiAgICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcclxuICAgICAgICB2YXIgbm93ID0gRGF0ZS5ub3coKTtcclxuICAgICAgICB2YXIgbmV4dFRpbWUgPSBNYXRoLm1heChsYXN0VGltZSArIDE2LCBub3cpO1xyXG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkgeyBjYWxsYmFjayhsYXN0VGltZSA9IG5leHRUaW1lKTsgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBuZXh0VGltZSAtIG5vdyk7XHJcbiAgICB9O1xyXG4gICAgd2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lID0gY2xlYXJUaW1lb3V0O1xyXG4gIH1cclxuICAvKipcclxuICAgKiBQb2x5ZmlsbCBmb3IgcGVyZm9ybWFuY2Uubm93LCByZXF1aXJlZCBieSByQUZcclxuICAgKi9cclxuICBpZighd2luZG93LnBlcmZvcm1hbmNlIHx8ICF3aW5kb3cucGVyZm9ybWFuY2Uubm93KXtcclxuICAgIHdpbmRvdy5wZXJmb3JtYW5jZSA9IHtcclxuICAgICAgc3RhcnQ6IERhdGUubm93KCksXHJcbiAgICAgIG5vdzogZnVuY3Rpb24oKXsgcmV0dXJuIERhdGUubm93KCkgLSB0aGlzLnN0YXJ0OyB9XHJcbiAgICB9O1xyXG4gIH1cclxufSkoKTtcclxuaWYgKCFGdW5jdGlvbi5wcm90b3R5cGUuYmluZCkge1xyXG4gIEZ1bmN0aW9uLnByb3RvdHlwZS5iaW5kID0gZnVuY3Rpb24ob1RoaXMpIHtcclxuICAgIGlmICh0eXBlb2YgdGhpcyAhPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAvLyBjbG9zZXN0IHRoaW5nIHBvc3NpYmxlIHRvIHRoZSBFQ01BU2NyaXB0IDVcclxuICAgICAgLy8gaW50ZXJuYWwgSXNDYWxsYWJsZSBmdW5jdGlvblxyXG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdGdW5jdGlvbi5wcm90b3R5cGUuYmluZCAtIHdoYXQgaXMgdHJ5aW5nIHRvIGJlIGJvdW5kIGlzIG5vdCBjYWxsYWJsZScpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBhQXJncyAgID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSxcclxuICAgICAgICBmVG9CaW5kID0gdGhpcyxcclxuICAgICAgICBmTk9QICAgID0gZnVuY3Rpb24oKSB7fSxcclxuICAgICAgICBmQm91bmQgID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICByZXR1cm4gZlRvQmluZC5hcHBseSh0aGlzIGluc3RhbmNlb2YgZk5PUFxyXG4gICAgICAgICAgICAgICAgID8gdGhpc1xyXG4gICAgICAgICAgICAgICAgIDogb1RoaXMsXHJcbiAgICAgICAgICAgICAgICAgYUFyZ3MuY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cykpKTtcclxuICAgICAgICB9O1xyXG5cclxuICAgIGlmICh0aGlzLnByb3RvdHlwZSkge1xyXG4gICAgICAvLyBuYXRpdmUgZnVuY3Rpb25zIGRvbid0IGhhdmUgYSBwcm90b3R5cGVcclxuICAgICAgZk5PUC5wcm90b3R5cGUgPSB0aGlzLnByb3RvdHlwZTtcclxuICAgIH1cclxuICAgIGZCb3VuZC5wcm90b3R5cGUgPSBuZXcgZk5PUCgpO1xyXG5cclxuICAgIHJldHVybiBmQm91bmQ7XHJcbiAgfTtcclxufVxyXG4vLyBQb2x5ZmlsbCB0byBnZXQgdGhlIG5hbWUgb2YgYSBmdW5jdGlvbiBpbiBJRTlcclxuZnVuY3Rpb24gZnVuY3Rpb25OYW1lKGZuKSB7XHJcbiAgaWYgKEZ1bmN0aW9uLnByb3RvdHlwZS5uYW1lID09PSB1bmRlZmluZWQpIHtcclxuICAgIHZhciBmdW5jTmFtZVJlZ2V4ID0gL2Z1bmN0aW9uXFxzKFteKF17MSx9KVxcKC87XHJcbiAgICB2YXIgcmVzdWx0cyA9IChmdW5jTmFtZVJlZ2V4KS5leGVjKChmbikudG9TdHJpbmcoKSk7XHJcbiAgICByZXR1cm4gKHJlc3VsdHMgJiYgcmVzdWx0cy5sZW5ndGggPiAxKSA/IHJlc3VsdHNbMV0udHJpbSgpIDogXCJcIjtcclxuICB9XHJcbiAgZWxzZSBpZiAoZm4ucHJvdG90eXBlID09PSB1bmRlZmluZWQpIHtcclxuICAgIHJldHVybiBmbi5jb25zdHJ1Y3Rvci5uYW1lO1xyXG4gIH1cclxuICBlbHNlIHtcclxuICAgIHJldHVybiBmbi5wcm90b3R5cGUuY29uc3RydWN0b3IubmFtZTtcclxuICB9XHJcbn1cclxuZnVuY3Rpb24gcGFyc2VWYWx1ZShzdHIpe1xyXG4gIGlmICgndHJ1ZScgPT09IHN0cikgcmV0dXJuIHRydWU7XHJcbiAgZWxzZSBpZiAoJ2ZhbHNlJyA9PT0gc3RyKSByZXR1cm4gZmFsc2U7XHJcbiAgZWxzZSBpZiAoIWlzTmFOKHN0ciAqIDEpKSByZXR1cm4gcGFyc2VGbG9hdChzdHIpO1xyXG4gIHJldHVybiBzdHI7XHJcbn1cclxuLy8gQ29udmVydCBQYXNjYWxDYXNlIHRvIGtlYmFiLWNhc2VcclxuLy8gVGhhbmsgeW91OiBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS84OTU1NTgwXHJcbmZ1bmN0aW9uIGh5cGhlbmF0ZShzdHIpIHtcclxuICByZXR1cm4gc3RyLnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pL2csICckMS0kMicpLnRvTG93ZXJDYXNlKCk7XHJcbn1cclxuXHJcbn0oalF1ZXJ5KTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuIWZ1bmN0aW9uKCQpIHtcclxuXHJcbkZvdW5kYXRpb24uQm94ID0ge1xyXG4gIEltTm90VG91Y2hpbmdZb3U6IEltTm90VG91Y2hpbmdZb3UsXHJcbiAgR2V0RGltZW5zaW9uczogR2V0RGltZW5zaW9ucyxcclxuICBHZXRPZmZzZXRzOiBHZXRPZmZzZXRzXHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb21wYXJlcyB0aGUgZGltZW5zaW9ucyBvZiBhbiBlbGVtZW50IHRvIGEgY29udGFpbmVyIGFuZCBkZXRlcm1pbmVzIGNvbGxpc2lvbiBldmVudHMgd2l0aCBjb250YWluZXIuXHJcbiAqIEBmdW5jdGlvblxyXG4gKiBAcGFyYW0ge2pRdWVyeX0gZWxlbWVudCAtIGpRdWVyeSBvYmplY3QgdG8gdGVzdCBmb3IgY29sbGlzaW9ucy5cclxuICogQHBhcmFtIHtqUXVlcnl9IHBhcmVudCAtIGpRdWVyeSBvYmplY3QgdG8gdXNlIGFzIGJvdW5kaW5nIGNvbnRhaW5lci5cclxuICogQHBhcmFtIHtCb29sZWFufSBsck9ubHkgLSBzZXQgdG8gdHJ1ZSB0byBjaGVjayBsZWZ0IGFuZCByaWdodCB2YWx1ZXMgb25seS5cclxuICogQHBhcmFtIHtCb29sZWFufSB0Yk9ubHkgLSBzZXQgdG8gdHJ1ZSB0byBjaGVjayB0b3AgYW5kIGJvdHRvbSB2YWx1ZXMgb25seS5cclxuICogQGRlZmF1bHQgaWYgbm8gcGFyZW50IG9iamVjdCBwYXNzZWQsIGRldGVjdHMgY29sbGlzaW9ucyB3aXRoIGB3aW5kb3dgLlxyXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn0gLSB0cnVlIGlmIGNvbGxpc2lvbiBmcmVlLCBmYWxzZSBpZiBhIGNvbGxpc2lvbiBpbiBhbnkgZGlyZWN0aW9uLlxyXG4gKi9cclxuZnVuY3Rpb24gSW1Ob3RUb3VjaGluZ1lvdShlbGVtZW50LCBwYXJlbnQsIGxyT25seSwgdGJPbmx5KSB7XHJcbiAgdmFyIGVsZURpbXMgPSBHZXREaW1lbnNpb25zKGVsZW1lbnQpLFxyXG4gICAgICB0b3AsIGJvdHRvbSwgbGVmdCwgcmlnaHQ7XHJcblxyXG4gIGlmIChwYXJlbnQpIHtcclxuICAgIHZhciBwYXJEaW1zID0gR2V0RGltZW5zaW9ucyhwYXJlbnQpO1xyXG5cclxuICAgIGJvdHRvbSA9IChlbGVEaW1zLm9mZnNldC50b3AgKyBlbGVEaW1zLmhlaWdodCA8PSBwYXJEaW1zLmhlaWdodCArIHBhckRpbXMub2Zmc2V0LnRvcCk7XHJcbiAgICB0b3AgICAgPSAoZWxlRGltcy5vZmZzZXQudG9wID49IHBhckRpbXMub2Zmc2V0LnRvcCk7XHJcbiAgICBsZWZ0ICAgPSAoZWxlRGltcy5vZmZzZXQubGVmdCA+PSBwYXJEaW1zLm9mZnNldC5sZWZ0KTtcclxuICAgIHJpZ2h0ICA9IChlbGVEaW1zLm9mZnNldC5sZWZ0ICsgZWxlRGltcy53aWR0aCA8PSBwYXJEaW1zLndpZHRoICsgcGFyRGltcy5vZmZzZXQubGVmdCk7XHJcbiAgfVxyXG4gIGVsc2Uge1xyXG4gICAgYm90dG9tID0gKGVsZURpbXMub2Zmc2V0LnRvcCArIGVsZURpbXMuaGVpZ2h0IDw9IGVsZURpbXMud2luZG93RGltcy5oZWlnaHQgKyBlbGVEaW1zLndpbmRvd0RpbXMub2Zmc2V0LnRvcCk7XHJcbiAgICB0b3AgICAgPSAoZWxlRGltcy5vZmZzZXQudG9wID49IGVsZURpbXMud2luZG93RGltcy5vZmZzZXQudG9wKTtcclxuICAgIGxlZnQgICA9IChlbGVEaW1zLm9mZnNldC5sZWZ0ID49IGVsZURpbXMud2luZG93RGltcy5vZmZzZXQubGVmdCk7XHJcbiAgICByaWdodCAgPSAoZWxlRGltcy5vZmZzZXQubGVmdCArIGVsZURpbXMud2lkdGggPD0gZWxlRGltcy53aW5kb3dEaW1zLndpZHRoKTtcclxuICB9XHJcblxyXG4gIHZhciBhbGxEaXJzID0gW2JvdHRvbSwgdG9wLCBsZWZ0LCByaWdodF07XHJcblxyXG4gIGlmIChsck9ubHkpIHtcclxuICAgIHJldHVybiBsZWZ0ID09PSByaWdodCA9PT0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIGlmICh0Yk9ubHkpIHtcclxuICAgIHJldHVybiB0b3AgPT09IGJvdHRvbSA9PT0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIHJldHVybiBhbGxEaXJzLmluZGV4T2YoZmFsc2UpID09PSAtMTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBVc2VzIG5hdGl2ZSBtZXRob2RzIHRvIHJldHVybiBhbiBvYmplY3Qgb2YgZGltZW5zaW9uIHZhbHVlcy5cclxuICogQGZ1bmN0aW9uXHJcbiAqIEBwYXJhbSB7alF1ZXJ5IHx8IEhUTUx9IGVsZW1lbnQgLSBqUXVlcnkgb2JqZWN0IG9yIERPTSBlbGVtZW50IGZvciB3aGljaCB0byBnZXQgdGhlIGRpbWVuc2lvbnMuIENhbiBiZSBhbnkgZWxlbWVudCBvdGhlciB0aGF0IGRvY3VtZW50IG9yIHdpbmRvdy5cclxuICogQHJldHVybnMge09iamVjdH0gLSBuZXN0ZWQgb2JqZWN0IG9mIGludGVnZXIgcGl4ZWwgdmFsdWVzXHJcbiAqIFRPRE8gLSBpZiBlbGVtZW50IGlzIHdpbmRvdywgcmV0dXJuIG9ubHkgdGhvc2UgdmFsdWVzLlxyXG4gKi9cclxuZnVuY3Rpb24gR2V0RGltZW5zaW9ucyhlbGVtLCB0ZXN0KXtcclxuICBlbGVtID0gZWxlbS5sZW5ndGggPyBlbGVtWzBdIDogZWxlbTtcclxuXHJcbiAgaWYgKGVsZW0gPT09IHdpbmRvdyB8fCBlbGVtID09PSBkb2N1bWVudCkge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiSSdtIHNvcnJ5LCBEYXZlLiBJJ20gYWZyYWlkIEkgY2FuJ3QgZG8gdGhhdC5cIik7XHJcbiAgfVxyXG5cclxuICB2YXIgcmVjdCA9IGVsZW0uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCksXHJcbiAgICAgIHBhclJlY3QgPSBlbGVtLnBhcmVudE5vZGUuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCksXHJcbiAgICAgIHdpblJlY3QgPSBkb2N1bWVudC5ib2R5LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLFxyXG4gICAgICB3aW5ZID0gd2luZG93LnBhZ2VZT2Zmc2V0LFxyXG4gICAgICB3aW5YID0gd2luZG93LnBhZ2VYT2Zmc2V0O1xyXG5cclxuICByZXR1cm4ge1xyXG4gICAgd2lkdGg6IHJlY3Qud2lkdGgsXHJcbiAgICBoZWlnaHQ6IHJlY3QuaGVpZ2h0LFxyXG4gICAgb2Zmc2V0OiB7XHJcbiAgICAgIHRvcDogcmVjdC50b3AgKyB3aW5ZLFxyXG4gICAgICBsZWZ0OiByZWN0LmxlZnQgKyB3aW5YXHJcbiAgICB9LFxyXG4gICAgcGFyZW50RGltczoge1xyXG4gICAgICB3aWR0aDogcGFyUmVjdC53aWR0aCxcclxuICAgICAgaGVpZ2h0OiBwYXJSZWN0LmhlaWdodCxcclxuICAgICAgb2Zmc2V0OiB7XHJcbiAgICAgICAgdG9wOiBwYXJSZWN0LnRvcCArIHdpblksXHJcbiAgICAgICAgbGVmdDogcGFyUmVjdC5sZWZ0ICsgd2luWFxyXG4gICAgICB9XHJcbiAgICB9LFxyXG4gICAgd2luZG93RGltczoge1xyXG4gICAgICB3aWR0aDogd2luUmVjdC53aWR0aCxcclxuICAgICAgaGVpZ2h0OiB3aW5SZWN0LmhlaWdodCxcclxuICAgICAgb2Zmc2V0OiB7XHJcbiAgICAgICAgdG9wOiB3aW5ZLFxyXG4gICAgICAgIGxlZnQ6IHdpblhcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIFJldHVybnMgYW4gb2JqZWN0IG9mIHRvcCBhbmQgbGVmdCBpbnRlZ2VyIHBpeGVsIHZhbHVlcyBmb3IgZHluYW1pY2FsbHkgcmVuZGVyZWQgZWxlbWVudHMsXHJcbiAqIHN1Y2ggYXM6IFRvb2x0aXAsIFJldmVhbCwgYW5kIERyb3Bkb3duXHJcbiAqIEBmdW5jdGlvblxyXG4gKiBAcGFyYW0ge2pRdWVyeX0gZWxlbWVudCAtIGpRdWVyeSBvYmplY3QgZm9yIHRoZSBlbGVtZW50IGJlaW5nIHBvc2l0aW9uZWQuXHJcbiAqIEBwYXJhbSB7alF1ZXJ5fSBhbmNob3IgLSBqUXVlcnkgb2JqZWN0IGZvciB0aGUgZWxlbWVudCdzIGFuY2hvciBwb2ludC5cclxuICogQHBhcmFtIHtTdHJpbmd9IHBvc2l0aW9uIC0gYSBzdHJpbmcgcmVsYXRpbmcgdG8gdGhlIGRlc2lyZWQgcG9zaXRpb24gb2YgdGhlIGVsZW1lbnQsIHJlbGF0aXZlIHRvIGl0J3MgYW5jaG9yXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSB2T2Zmc2V0IC0gaW50ZWdlciBwaXhlbCB2YWx1ZSBvZiBkZXNpcmVkIHZlcnRpY2FsIHNlcGFyYXRpb24gYmV0d2VlbiBhbmNob3IgYW5kIGVsZW1lbnQuXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBoT2Zmc2V0IC0gaW50ZWdlciBwaXhlbCB2YWx1ZSBvZiBkZXNpcmVkIGhvcml6b250YWwgc2VwYXJhdGlvbiBiZXR3ZWVuIGFuY2hvciBhbmQgZWxlbWVudC5cclxuICogQHBhcmFtIHtCb29sZWFufSBpc092ZXJmbG93IC0gaWYgYSBjb2xsaXNpb24gZXZlbnQgaXMgZGV0ZWN0ZWQsIHNldHMgdG8gdHJ1ZSB0byBkZWZhdWx0IHRoZSBlbGVtZW50IHRvIGZ1bGwgd2lkdGggLSBhbnkgZGVzaXJlZCBvZmZzZXQuXHJcbiAqIFRPRE8gYWx0ZXIvcmV3cml0ZSB0byB3b3JrIHdpdGggYGVtYCB2YWx1ZXMgYXMgd2VsbC9pbnN0ZWFkIG9mIHBpeGVsc1xyXG4gKi9cclxuZnVuY3Rpb24gR2V0T2Zmc2V0cyhlbGVtZW50LCBhbmNob3IsIHBvc2l0aW9uLCB2T2Zmc2V0LCBoT2Zmc2V0LCBpc092ZXJmbG93KSB7XHJcbiAgdmFyICRlbGVEaW1zID0gR2V0RGltZW5zaW9ucyhlbGVtZW50KSxcclxuICAgICAgJGFuY2hvckRpbXMgPSBhbmNob3IgPyBHZXREaW1lbnNpb25zKGFuY2hvcikgOiBudWxsO1xyXG5cclxuICBzd2l0Y2ggKHBvc2l0aW9uKSB7XHJcbiAgICBjYXNlICd0b3AnOlxyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIGxlZnQ6IChGb3VuZGF0aW9uLnJ0bCgpID8gJGFuY2hvckRpbXMub2Zmc2V0LmxlZnQgLSAkZWxlRGltcy53aWR0aCArICRhbmNob3JEaW1zLndpZHRoIDogJGFuY2hvckRpbXMub2Zmc2V0LmxlZnQpLFxyXG4gICAgICAgIHRvcDogJGFuY2hvckRpbXMub2Zmc2V0LnRvcCAtICgkZWxlRGltcy5oZWlnaHQgKyB2T2Zmc2V0KVxyXG4gICAgICB9XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSAnbGVmdCc6XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgbGVmdDogJGFuY2hvckRpbXMub2Zmc2V0LmxlZnQgLSAoJGVsZURpbXMud2lkdGggKyBoT2Zmc2V0KSxcclxuICAgICAgICB0b3A6ICRhbmNob3JEaW1zLm9mZnNldC50b3BcclxuICAgICAgfVxyXG4gICAgICBicmVhaztcclxuICAgIGNhc2UgJ3JpZ2h0JzpcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBsZWZ0OiAkYW5jaG9yRGltcy5vZmZzZXQubGVmdCArICRhbmNob3JEaW1zLndpZHRoICsgaE9mZnNldCxcclxuICAgICAgICB0b3A6ICRhbmNob3JEaW1zLm9mZnNldC50b3BcclxuICAgICAgfVxyXG4gICAgICBicmVhaztcclxuICAgIGNhc2UgJ2NlbnRlciB0b3AnOlxyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIGxlZnQ6ICgkYW5jaG9yRGltcy5vZmZzZXQubGVmdCArICgkYW5jaG9yRGltcy53aWR0aCAvIDIpKSAtICgkZWxlRGltcy53aWR0aCAvIDIpLFxyXG4gICAgICAgIHRvcDogJGFuY2hvckRpbXMub2Zmc2V0LnRvcCAtICgkZWxlRGltcy5oZWlnaHQgKyB2T2Zmc2V0KVxyXG4gICAgICB9XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSAnY2VudGVyIGJvdHRvbSc6XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgbGVmdDogaXNPdmVyZmxvdyA/IGhPZmZzZXQgOiAoKCRhbmNob3JEaW1zLm9mZnNldC5sZWZ0ICsgKCRhbmNob3JEaW1zLndpZHRoIC8gMikpIC0gKCRlbGVEaW1zLndpZHRoIC8gMikpLFxyXG4gICAgICAgIHRvcDogJGFuY2hvckRpbXMub2Zmc2V0LnRvcCArICRhbmNob3JEaW1zLmhlaWdodCArIHZPZmZzZXRcclxuICAgICAgfVxyXG4gICAgICBicmVhaztcclxuICAgIGNhc2UgJ2NlbnRlciBsZWZ0JzpcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBsZWZ0OiAkYW5jaG9yRGltcy5vZmZzZXQubGVmdCAtICgkZWxlRGltcy53aWR0aCArIGhPZmZzZXQpLFxyXG4gICAgICAgIHRvcDogKCRhbmNob3JEaW1zLm9mZnNldC50b3AgKyAoJGFuY2hvckRpbXMuaGVpZ2h0IC8gMikpIC0gKCRlbGVEaW1zLmhlaWdodCAvIDIpXHJcbiAgICAgIH1cclxuICAgICAgYnJlYWs7XHJcbiAgICBjYXNlICdjZW50ZXIgcmlnaHQnOlxyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIGxlZnQ6ICRhbmNob3JEaW1zLm9mZnNldC5sZWZ0ICsgJGFuY2hvckRpbXMud2lkdGggKyBoT2Zmc2V0ICsgMSxcclxuICAgICAgICB0b3A6ICgkYW5jaG9yRGltcy5vZmZzZXQudG9wICsgKCRhbmNob3JEaW1zLmhlaWdodCAvIDIpKSAtICgkZWxlRGltcy5oZWlnaHQgLyAyKVxyXG4gICAgICB9XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSAnY2VudGVyJzpcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBsZWZ0OiAoJGVsZURpbXMud2luZG93RGltcy5vZmZzZXQubGVmdCArICgkZWxlRGltcy53aW5kb3dEaW1zLndpZHRoIC8gMikpIC0gKCRlbGVEaW1zLndpZHRoIC8gMiksXHJcbiAgICAgICAgdG9wOiAoJGVsZURpbXMud2luZG93RGltcy5vZmZzZXQudG9wICsgKCRlbGVEaW1zLndpbmRvd0RpbXMuaGVpZ2h0IC8gMikpIC0gKCRlbGVEaW1zLmhlaWdodCAvIDIpXHJcbiAgICAgIH1cclxuICAgICAgYnJlYWs7XHJcbiAgICBjYXNlICdyZXZlYWwnOlxyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIGxlZnQ6ICgkZWxlRGltcy53aW5kb3dEaW1zLndpZHRoIC0gJGVsZURpbXMud2lkdGgpIC8gMixcclxuICAgICAgICB0b3A6ICRlbGVEaW1zLndpbmRvd0RpbXMub2Zmc2V0LnRvcCArIHZPZmZzZXRcclxuICAgICAgfVxyXG4gICAgY2FzZSAncmV2ZWFsIGZ1bGwnOlxyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIGxlZnQ6ICRlbGVEaW1zLndpbmRvd0RpbXMub2Zmc2V0LmxlZnQsXHJcbiAgICAgICAgdG9wOiAkZWxlRGltcy53aW5kb3dEaW1zLm9mZnNldC50b3BcclxuICAgICAgfVxyXG4gICAgICBicmVhaztcclxuICAgIGNhc2UgJ2xlZnQgYm90dG9tJzpcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBsZWZ0OiAkYW5jaG9yRGltcy5vZmZzZXQubGVmdCxcclxuICAgICAgICB0b3A6ICRhbmNob3JEaW1zLm9mZnNldC50b3AgKyAkYW5jaG9yRGltcy5oZWlnaHQgKyB2T2Zmc2V0XHJcbiAgICAgIH07XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSAncmlnaHQgYm90dG9tJzpcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBsZWZ0OiAkYW5jaG9yRGltcy5vZmZzZXQubGVmdCArICRhbmNob3JEaW1zLndpZHRoICsgaE9mZnNldCAtICRlbGVEaW1zLndpZHRoLFxyXG4gICAgICAgIHRvcDogJGFuY2hvckRpbXMub2Zmc2V0LnRvcCArICRhbmNob3JEaW1zLmhlaWdodCArIHZPZmZzZXRcclxuICAgICAgfTtcclxuICAgICAgYnJlYWs7XHJcbiAgICBkZWZhdWx0OlxyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIGxlZnQ6IChGb3VuZGF0aW9uLnJ0bCgpID8gJGFuY2hvckRpbXMub2Zmc2V0LmxlZnQgLSAkZWxlRGltcy53aWR0aCArICRhbmNob3JEaW1zLndpZHRoIDogJGFuY2hvckRpbXMub2Zmc2V0LmxlZnQgKyBoT2Zmc2V0KSxcclxuICAgICAgICB0b3A6ICRhbmNob3JEaW1zLm9mZnNldC50b3AgKyAkYW5jaG9yRGltcy5oZWlnaHQgKyB2T2Zmc2V0XHJcbiAgICAgIH1cclxuICB9XHJcbn1cclxuXHJcbn0oalF1ZXJ5KTtcclxuIiwiLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcclxuICogVGhpcyB1dGlsIHdhcyBjcmVhdGVkIGJ5IE1hcml1cyBPbGJlcnR6ICpcclxuICogUGxlYXNlIHRoYW5rIE1hcml1cyBvbiBHaXRIdWIgL293bGJlcnR6ICpcclxuICogb3IgdGhlIHdlYiBodHRwOi8vd3d3Lm1hcml1c29sYmVydHouZGUvICpcclxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcclxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cclxuXHJcbid1c2Ugc3RyaWN0JztcclxuXHJcbiFmdW5jdGlvbigkKSB7XHJcblxyXG5jb25zdCBrZXlDb2RlcyA9IHtcclxuICA5OiAnVEFCJyxcclxuICAxMzogJ0VOVEVSJyxcclxuICAyNzogJ0VTQ0FQRScsXHJcbiAgMzI6ICdTUEFDRScsXHJcbiAgMzc6ICdBUlJPV19MRUZUJyxcclxuICAzODogJ0FSUk9XX1VQJyxcclxuICAzOTogJ0FSUk9XX1JJR0hUJyxcclxuICA0MDogJ0FSUk9XX0RPV04nXHJcbn1cclxuXHJcbnZhciBjb21tYW5kcyA9IHt9XHJcblxyXG52YXIgS2V5Ym9hcmQgPSB7XHJcbiAga2V5czogZ2V0S2V5Q29kZXMoa2V5Q29kZXMpLFxyXG5cclxuICAvKipcclxuICAgKiBQYXJzZXMgdGhlIChrZXlib2FyZCkgZXZlbnQgYW5kIHJldHVybnMgYSBTdHJpbmcgdGhhdCByZXByZXNlbnRzIGl0cyBrZXlcclxuICAgKiBDYW4gYmUgdXNlZCBsaWtlIEZvdW5kYXRpb24ucGFyc2VLZXkoZXZlbnQpID09PSBGb3VuZGF0aW9uLmtleXMuU1BBQ0VcclxuICAgKiBAcGFyYW0ge0V2ZW50fSBldmVudCAtIHRoZSBldmVudCBnZW5lcmF0ZWQgYnkgdGhlIGV2ZW50IGhhbmRsZXJcclxuICAgKiBAcmV0dXJuIFN0cmluZyBrZXkgLSBTdHJpbmcgdGhhdCByZXByZXNlbnRzIHRoZSBrZXkgcHJlc3NlZFxyXG4gICAqL1xyXG4gIHBhcnNlS2V5KGV2ZW50KSB7XHJcbiAgICB2YXIga2V5ID0ga2V5Q29kZXNbZXZlbnQud2hpY2ggfHwgZXZlbnQua2V5Q29kZV0gfHwgU3RyaW5nLmZyb21DaGFyQ29kZShldmVudC53aGljaCkudG9VcHBlckNhc2UoKTtcclxuXHJcbiAgICAvLyBSZW1vdmUgdW4tcHJpbnRhYmxlIGNoYXJhY3RlcnMsIGUuZy4gZm9yIGBmcm9tQ2hhckNvZGVgIGNhbGxzIGZvciBDVFJMIG9ubHkgZXZlbnRzXHJcbiAgICBrZXkgPSBrZXkucmVwbGFjZSgvXFxXKy8sICcnKTtcclxuXHJcbiAgICBpZiAoZXZlbnQuc2hpZnRLZXkpIGtleSA9IGBTSElGVF8ke2tleX1gO1xyXG4gICAgaWYgKGV2ZW50LmN0cmxLZXkpIGtleSA9IGBDVFJMXyR7a2V5fWA7XHJcbiAgICBpZiAoZXZlbnQuYWx0S2V5KSBrZXkgPSBgQUxUXyR7a2V5fWA7XHJcblxyXG4gICAgLy8gUmVtb3ZlIHRyYWlsaW5nIHVuZGVyc2NvcmUsIGluIGNhc2Ugb25seSBtb2RpZmllcnMgd2VyZSB1c2VkIChlLmcuIG9ubHkgYENUUkxfQUxUYClcclxuICAgIGtleSA9IGtleS5yZXBsYWNlKC9fJC8sICcnKTtcclxuXHJcbiAgICByZXR1cm4ga2V5O1xyXG4gIH0sXHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZXMgdGhlIGdpdmVuIChrZXlib2FyZCkgZXZlbnRcclxuICAgKiBAcGFyYW0ge0V2ZW50fSBldmVudCAtIHRoZSBldmVudCBnZW5lcmF0ZWQgYnkgdGhlIGV2ZW50IGhhbmRsZXJcclxuICAgKiBAcGFyYW0ge1N0cmluZ30gY29tcG9uZW50IC0gRm91bmRhdGlvbiBjb21wb25lbnQncyBuYW1lLCBlLmcuIFNsaWRlciBvciBSZXZlYWxcclxuICAgKiBAcGFyYW0ge09iamVjdHN9IGZ1bmN0aW9ucyAtIGNvbGxlY3Rpb24gb2YgZnVuY3Rpb25zIHRoYXQgYXJlIHRvIGJlIGV4ZWN1dGVkXHJcbiAgICovXHJcbiAgaGFuZGxlS2V5KGV2ZW50LCBjb21wb25lbnQsIGZ1bmN0aW9ucykge1xyXG4gICAgdmFyIGNvbW1hbmRMaXN0ID0gY29tbWFuZHNbY29tcG9uZW50XSxcclxuICAgICAga2V5Q29kZSA9IHRoaXMucGFyc2VLZXkoZXZlbnQpLFxyXG4gICAgICBjbWRzLFxyXG4gICAgICBjb21tYW5kLFxyXG4gICAgICBmbjtcclxuXHJcbiAgICBpZiAoIWNvbW1hbmRMaXN0KSByZXR1cm4gY29uc29sZS53YXJuKCdDb21wb25lbnQgbm90IGRlZmluZWQhJyk7XHJcblxyXG4gICAgaWYgKHR5cGVvZiBjb21tYW5kTGlzdC5sdHIgPT09ICd1bmRlZmluZWQnKSB7IC8vIHRoaXMgY29tcG9uZW50IGRvZXMgbm90IGRpZmZlcmVudGlhdGUgYmV0d2VlbiBsdHIgYW5kIHJ0bFxyXG4gICAgICAgIGNtZHMgPSBjb21tYW5kTGlzdDsgLy8gdXNlIHBsYWluIGxpc3RcclxuICAgIH0gZWxzZSB7IC8vIG1lcmdlIGx0ciBhbmQgcnRsOiBpZiBkb2N1bWVudCBpcyBydGwsIHJ0bCBvdmVyd3JpdGVzIGx0ciBhbmQgdmljZSB2ZXJzYVxyXG4gICAgICAgIGlmIChGb3VuZGF0aW9uLnJ0bCgpKSBjbWRzID0gJC5leHRlbmQoe30sIGNvbW1hbmRMaXN0Lmx0ciwgY29tbWFuZExpc3QucnRsKTtcclxuXHJcbiAgICAgICAgZWxzZSBjbWRzID0gJC5leHRlbmQoe30sIGNvbW1hbmRMaXN0LnJ0bCwgY29tbWFuZExpc3QubHRyKTtcclxuICAgIH1cclxuICAgIGNvbW1hbmQgPSBjbWRzW2tleUNvZGVdO1xyXG5cclxuICAgIGZuID0gZnVuY3Rpb25zW2NvbW1hbmRdO1xyXG4gICAgaWYgKGZuICYmIHR5cGVvZiBmbiA9PT0gJ2Z1bmN0aW9uJykgeyAvLyBleGVjdXRlIGZ1bmN0aW9uICBpZiBleGlzdHNcclxuICAgICAgdmFyIHJldHVyblZhbHVlID0gZm4uYXBwbHkoKTtcclxuICAgICAgaWYgKGZ1bmN0aW9ucy5oYW5kbGVkIHx8IHR5cGVvZiBmdW5jdGlvbnMuaGFuZGxlZCA9PT0gJ2Z1bmN0aW9uJykgeyAvLyBleGVjdXRlIGZ1bmN0aW9uIHdoZW4gZXZlbnQgd2FzIGhhbmRsZWRcclxuICAgICAgICAgIGZ1bmN0aW9ucy5oYW5kbGVkKHJldHVyblZhbHVlKTtcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgaWYgKGZ1bmN0aW9ucy51bmhhbmRsZWQgfHwgdHlwZW9mIGZ1bmN0aW9ucy51bmhhbmRsZWQgPT09ICdmdW5jdGlvbicpIHsgLy8gZXhlY3V0ZSBmdW5jdGlvbiB3aGVuIGV2ZW50IHdhcyBub3QgaGFuZGxlZFxyXG4gICAgICAgICAgZnVuY3Rpb25zLnVuaGFuZGxlZCgpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfSxcclxuXHJcbiAgLyoqXHJcbiAgICogRmluZHMgYWxsIGZvY3VzYWJsZSBlbGVtZW50cyB3aXRoaW4gdGhlIGdpdmVuIGAkZWxlbWVudGBcclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gJGVsZW1lbnQgLSBqUXVlcnkgb2JqZWN0IHRvIHNlYXJjaCB3aXRoaW5cclxuICAgKiBAcmV0dXJuIHtqUXVlcnl9ICRmb2N1c2FibGUgLSBhbGwgZm9jdXNhYmxlIGVsZW1lbnRzIHdpdGhpbiBgJGVsZW1lbnRgXHJcbiAgICovXHJcbiAgZmluZEZvY3VzYWJsZSgkZWxlbWVudCkge1xyXG4gICAgaWYoISRlbGVtZW50KSB7cmV0dXJuIGZhbHNlOyB9XHJcbiAgICByZXR1cm4gJGVsZW1lbnQuZmluZCgnYVtocmVmXSwgYXJlYVtocmVmXSwgaW5wdXQ6bm90KFtkaXNhYmxlZF0pLCBzZWxlY3Q6bm90KFtkaXNhYmxlZF0pLCB0ZXh0YXJlYTpub3QoW2Rpc2FibGVkXSksIGJ1dHRvbjpub3QoW2Rpc2FibGVkXSksIGlmcmFtZSwgb2JqZWN0LCBlbWJlZCwgKlt0YWJpbmRleF0sICpbY29udGVudGVkaXRhYmxlXScpLmZpbHRlcihmdW5jdGlvbigpIHtcclxuICAgICAgaWYgKCEkKHRoaXMpLmlzKCc6dmlzaWJsZScpIHx8ICQodGhpcykuYXR0cigndGFiaW5kZXgnKSA8IDApIHsgcmV0dXJuIGZhbHNlOyB9IC8vb25seSBoYXZlIHZpc2libGUgZWxlbWVudHMgYW5kIHRob3NlIHRoYXQgaGF2ZSBhIHRhYmluZGV4IGdyZWF0ZXIgb3IgZXF1YWwgMFxyXG4gICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH0pO1xyXG4gIH0sXHJcblxyXG4gIC8qKlxyXG4gICAqIFJldHVybnMgdGhlIGNvbXBvbmVudCBuYW1lIG5hbWVcclxuICAgKiBAcGFyYW0ge09iamVjdH0gY29tcG9uZW50IC0gRm91bmRhdGlvbiBjb21wb25lbnQsIGUuZy4gU2xpZGVyIG9yIFJldmVhbFxyXG4gICAqIEByZXR1cm4gU3RyaW5nIGNvbXBvbmVudE5hbWVcclxuICAgKi9cclxuXHJcbiAgcmVnaXN0ZXIoY29tcG9uZW50TmFtZSwgY21kcykge1xyXG4gICAgY29tbWFuZHNbY29tcG9uZW50TmFtZV0gPSBjbWRzO1xyXG4gIH0sICBcclxuXHJcbiAgLyoqXHJcbiAgICogVHJhcHMgdGhlIGZvY3VzIGluIHRoZSBnaXZlbiBlbGVtZW50LlxyXG4gICAqIEBwYXJhbSAge2pRdWVyeX0gJGVsZW1lbnQgIGpRdWVyeSBvYmplY3QgdG8gdHJhcCB0aGUgZm91Y3MgaW50by5cclxuICAgKi9cclxuICB0cmFwRm9jdXMoJGVsZW1lbnQpIHtcclxuICAgIHZhciAkZm9jdXNhYmxlID0gRm91bmRhdGlvbi5LZXlib2FyZC5maW5kRm9jdXNhYmxlKCRlbGVtZW50KSxcclxuICAgICAgICAkZmlyc3RGb2N1c2FibGUgPSAkZm9jdXNhYmxlLmVxKDApLFxyXG4gICAgICAgICRsYXN0Rm9jdXNhYmxlID0gJGZvY3VzYWJsZS5lcSgtMSk7XHJcblxyXG4gICAgJGVsZW1lbnQub24oJ2tleWRvd24uemYudHJhcGZvY3VzJywgZnVuY3Rpb24oZXZlbnQpIHtcclxuICAgICAgaWYgKGV2ZW50LnRhcmdldCA9PT0gJGxhc3RGb2N1c2FibGVbMF0gJiYgRm91bmRhdGlvbi5LZXlib2FyZC5wYXJzZUtleShldmVudCkgPT09ICdUQUInKSB7XHJcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAkZmlyc3RGb2N1c2FibGUuZm9jdXMoKTtcclxuICAgICAgfVxyXG4gICAgICBlbHNlIGlmIChldmVudC50YXJnZXQgPT09ICRmaXJzdEZvY3VzYWJsZVswXSAmJiBGb3VuZGF0aW9uLktleWJvYXJkLnBhcnNlS2V5KGV2ZW50KSA9PT0gJ1NISUZUX1RBQicpIHtcclxuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICRsYXN0Rm9jdXNhYmxlLmZvY3VzKCk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH0sXHJcbiAgLyoqXHJcbiAgICogUmVsZWFzZXMgdGhlIHRyYXBwZWQgZm9jdXMgZnJvbSB0aGUgZ2l2ZW4gZWxlbWVudC5cclxuICAgKiBAcGFyYW0gIHtqUXVlcnl9ICRlbGVtZW50ICBqUXVlcnkgb2JqZWN0IHRvIHJlbGVhc2UgdGhlIGZvY3VzIGZvci5cclxuICAgKi9cclxuICByZWxlYXNlRm9jdXMoJGVsZW1lbnQpIHtcclxuICAgICRlbGVtZW50Lm9mZigna2V5ZG93bi56Zi50cmFwZm9jdXMnKTtcclxuICB9XHJcbn1cclxuXHJcbi8qXHJcbiAqIENvbnN0YW50cyBmb3IgZWFzaWVyIGNvbXBhcmluZy5cclxuICogQ2FuIGJlIHVzZWQgbGlrZSBGb3VuZGF0aW9uLnBhcnNlS2V5KGV2ZW50KSA9PT0gRm91bmRhdGlvbi5rZXlzLlNQQUNFXHJcbiAqL1xyXG5mdW5jdGlvbiBnZXRLZXlDb2RlcyhrY3MpIHtcclxuICB2YXIgayA9IHt9O1xyXG4gIGZvciAodmFyIGtjIGluIGtjcykga1trY3Nba2NdXSA9IGtjc1trY107XHJcbiAgcmV0dXJuIGs7XHJcbn1cclxuXHJcbkZvdW5kYXRpb24uS2V5Ym9hcmQgPSBLZXlib2FyZDtcclxuXHJcbn0oalF1ZXJ5KTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuIWZ1bmN0aW9uKCQpIHtcclxuXHJcbi8vIERlZmF1bHQgc2V0IG9mIG1lZGlhIHF1ZXJpZXNcclxuY29uc3QgZGVmYXVsdFF1ZXJpZXMgPSB7XHJcbiAgJ2RlZmF1bHQnIDogJ29ubHkgc2NyZWVuJyxcclxuICBsYW5kc2NhcGUgOiAnb25seSBzY3JlZW4gYW5kIChvcmllbnRhdGlvbjogbGFuZHNjYXBlKScsXHJcbiAgcG9ydHJhaXQgOiAnb25seSBzY3JlZW4gYW5kIChvcmllbnRhdGlvbjogcG9ydHJhaXQpJyxcclxuICByZXRpbmEgOiAnb25seSBzY3JlZW4gYW5kICgtd2Via2l0LW1pbi1kZXZpY2UtcGl4ZWwtcmF0aW86IDIpLCcgK1xyXG4gICAgJ29ubHkgc2NyZWVuIGFuZCAobWluLS1tb3otZGV2aWNlLXBpeGVsLXJhdGlvOiAyKSwnICtcclxuICAgICdvbmx5IHNjcmVlbiBhbmQgKC1vLW1pbi1kZXZpY2UtcGl4ZWwtcmF0aW86IDIvMSksJyArXHJcbiAgICAnb25seSBzY3JlZW4gYW5kIChtaW4tZGV2aWNlLXBpeGVsLXJhdGlvOiAyKSwnICtcclxuICAgICdvbmx5IHNjcmVlbiBhbmQgKG1pbi1yZXNvbHV0aW9uOiAxOTJkcGkpLCcgK1xyXG4gICAgJ29ubHkgc2NyZWVuIGFuZCAobWluLXJlc29sdXRpb246IDJkcHB4KSdcclxufTtcclxuXHJcbnZhciBNZWRpYVF1ZXJ5ID0ge1xyXG4gIHF1ZXJpZXM6IFtdLFxyXG5cclxuICBjdXJyZW50OiAnJyxcclxuXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbGl6ZXMgdGhlIG1lZGlhIHF1ZXJ5IGhlbHBlciwgYnkgZXh0cmFjdGluZyB0aGUgYnJlYWtwb2ludCBsaXN0IGZyb20gdGhlIENTUyBhbmQgYWN0aXZhdGluZyB0aGUgYnJlYWtwb2ludCB3YXRjaGVyLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2luaXQoKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcbiAgICB2YXIgZXh0cmFjdGVkU3R5bGVzID0gJCgnLmZvdW5kYXRpb24tbXEnKS5jc3MoJ2ZvbnQtZmFtaWx5Jyk7XHJcbiAgICB2YXIgbmFtZWRRdWVyaWVzO1xyXG5cclxuICAgIG5hbWVkUXVlcmllcyA9IHBhcnNlU3R5bGVUb09iamVjdChleHRyYWN0ZWRTdHlsZXMpO1xyXG5cclxuICAgIGZvciAodmFyIGtleSBpbiBuYW1lZFF1ZXJpZXMpIHtcclxuICAgICAgaWYobmFtZWRRdWVyaWVzLmhhc093blByb3BlcnR5KGtleSkpIHtcclxuICAgICAgICBzZWxmLnF1ZXJpZXMucHVzaCh7XHJcbiAgICAgICAgICBuYW1lOiBrZXksXHJcbiAgICAgICAgICB2YWx1ZTogYG9ubHkgc2NyZWVuIGFuZCAobWluLXdpZHRoOiAke25hbWVkUXVlcmllc1trZXldfSlgXHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmN1cnJlbnQgPSB0aGlzLl9nZXRDdXJyZW50U2l6ZSgpO1xyXG5cclxuICAgIHRoaXMuX3dhdGNoZXIoKTtcclxuICB9LFxyXG5cclxuICAvKipcclxuICAgKiBDaGVja3MgaWYgdGhlIHNjcmVlbiBpcyBhdCBsZWFzdCBhcyB3aWRlIGFzIGEgYnJlYWtwb2ludC5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcGFyYW0ge1N0cmluZ30gc2l6ZSAtIE5hbWUgb2YgdGhlIGJyZWFrcG9pbnQgdG8gY2hlY2suXHJcbiAgICogQHJldHVybnMge0Jvb2xlYW59IGB0cnVlYCBpZiB0aGUgYnJlYWtwb2ludCBtYXRjaGVzLCBgZmFsc2VgIGlmIGl0J3Mgc21hbGxlci5cclxuICAgKi9cclxuICBhdExlYXN0KHNpemUpIHtcclxuICAgIHZhciBxdWVyeSA9IHRoaXMuZ2V0KHNpemUpO1xyXG5cclxuICAgIGlmIChxdWVyeSkge1xyXG4gICAgICByZXR1cm4gd2luZG93Lm1hdGNoTWVkaWEocXVlcnkpLm1hdGNoZXM7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG4gIH0sXHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrcyBpZiB0aGUgc2NyZWVuIG1hdGNoZXMgdG8gYSBicmVha3BvaW50LlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBzaXplIC0gTmFtZSBvZiB0aGUgYnJlYWtwb2ludCB0byBjaGVjaywgZWl0aGVyICdzbWFsbCBvbmx5JyBvciAnc21hbGwnLiBPbWl0dGluZyAnb25seScgZmFsbHMgYmFjayB0byB1c2luZyBhdExlYXN0KCkgbWV0aG9kLlxyXG4gICAqIEByZXR1cm5zIHtCb29sZWFufSBgdHJ1ZWAgaWYgdGhlIGJyZWFrcG9pbnQgbWF0Y2hlcywgYGZhbHNlYCBpZiBpdCBkb2VzIG5vdC5cclxuICAgKi9cclxuICBpcyhzaXplKSB7XHJcbiAgICBzaXplID0gc2l6ZS50cmltKCkuc3BsaXQoJyAnKTtcclxuICAgIGlmKHNpemUubGVuZ3RoID4gMSAmJiBzaXplWzFdID09PSAnb25seScpIHtcclxuICAgICAgaWYoc2l6ZVswXSA9PT0gdGhpcy5fZ2V0Q3VycmVudFNpemUoKSkgcmV0dXJuIHRydWU7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICByZXR1cm4gdGhpcy5hdExlYXN0KHNpemVbMF0pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG4gIH0sXHJcblxyXG4gIC8qKlxyXG4gICAqIEdldHMgdGhlIG1lZGlhIHF1ZXJ5IG9mIGEgYnJlYWtwb2ludC5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcGFyYW0ge1N0cmluZ30gc2l6ZSAtIE5hbWUgb2YgdGhlIGJyZWFrcG9pbnQgdG8gZ2V0LlxyXG4gICAqIEByZXR1cm5zIHtTdHJpbmd8bnVsbH0gLSBUaGUgbWVkaWEgcXVlcnkgb2YgdGhlIGJyZWFrcG9pbnQsIG9yIGBudWxsYCBpZiB0aGUgYnJlYWtwb2ludCBkb2Vzbid0IGV4aXN0LlxyXG4gICAqL1xyXG4gIGdldChzaXplKSB7XHJcbiAgICBmb3IgKHZhciBpIGluIHRoaXMucXVlcmllcykge1xyXG4gICAgICBpZih0aGlzLnF1ZXJpZXMuaGFzT3duUHJvcGVydHkoaSkpIHtcclxuICAgICAgICB2YXIgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbaV07XHJcbiAgICAgICAgaWYgKHNpemUgPT09IHF1ZXJ5Lm5hbWUpIHJldHVybiBxdWVyeS52YWx1ZTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBudWxsO1xyXG4gIH0sXHJcblxyXG4gIC8qKlxyXG4gICAqIEdldHMgdGhlIGN1cnJlbnQgYnJlYWtwb2ludCBuYW1lIGJ5IHRlc3RpbmcgZXZlcnkgYnJlYWtwb2ludCBhbmQgcmV0dXJuaW5nIHRoZSBsYXN0IG9uZSB0byBtYXRjaCAodGhlIGJpZ2dlc3Qgb25lKS5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqIEByZXR1cm5zIHtTdHJpbmd9IE5hbWUgb2YgdGhlIGN1cnJlbnQgYnJlYWtwb2ludC5cclxuICAgKi9cclxuICBfZ2V0Q3VycmVudFNpemUoKSB7XHJcbiAgICB2YXIgbWF0Y2hlZDtcclxuXHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMucXVlcmllcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbaV07XHJcblxyXG4gICAgICBpZiAod2luZG93Lm1hdGNoTWVkaWEocXVlcnkudmFsdWUpLm1hdGNoZXMpIHtcclxuICAgICAgICBtYXRjaGVkID0gcXVlcnk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBpZiAodHlwZW9mIG1hdGNoZWQgPT09ICdvYmplY3QnKSB7XHJcbiAgICAgIHJldHVybiBtYXRjaGVkLm5hbWU7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICByZXR1cm4gbWF0Y2hlZDtcclxuICAgIH1cclxuICB9LFxyXG5cclxuICAvKipcclxuICAgKiBBY3RpdmF0ZXMgdGhlIGJyZWFrcG9pbnQgd2F0Y2hlciwgd2hpY2ggZmlyZXMgYW4gZXZlbnQgb24gdGhlIHdpbmRvdyB3aGVuZXZlciB0aGUgYnJlYWtwb2ludCBjaGFuZ2VzLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX3dhdGNoZXIoKSB7XHJcbiAgICAkKHdpbmRvdykub24oJ3Jlc2l6ZS56Zi5tZWRpYXF1ZXJ5JywgKCkgPT4ge1xyXG4gICAgICB2YXIgbmV3U2l6ZSA9IHRoaXMuX2dldEN1cnJlbnRTaXplKCksIGN1cnJlbnRTaXplID0gdGhpcy5jdXJyZW50O1xyXG5cclxuICAgICAgaWYgKG5ld1NpemUgIT09IGN1cnJlbnRTaXplKSB7XHJcbiAgICAgICAgLy8gQ2hhbmdlIHRoZSBjdXJyZW50IG1lZGlhIHF1ZXJ5XHJcbiAgICAgICAgdGhpcy5jdXJyZW50ID0gbmV3U2l6ZTtcclxuXHJcbiAgICAgICAgLy8gQnJvYWRjYXN0IHRoZSBtZWRpYSBxdWVyeSBjaGFuZ2Ugb24gdGhlIHdpbmRvd1xyXG4gICAgICAgICQod2luZG93KS50cmlnZ2VyKCdjaGFuZ2VkLnpmLm1lZGlhcXVlcnknLCBbbmV3U2l6ZSwgY3VycmVudFNpemVdKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG59O1xyXG5cclxuRm91bmRhdGlvbi5NZWRpYVF1ZXJ5ID0gTWVkaWFRdWVyeTtcclxuXHJcbi8vIG1hdGNoTWVkaWEoKSBwb2x5ZmlsbCAtIFRlc3QgYSBDU1MgbWVkaWEgdHlwZS9xdWVyeSBpbiBKUy5cclxuLy8gQXV0aG9ycyAmIGNvcHlyaWdodCAoYykgMjAxMjogU2NvdHQgSmVobCwgUGF1bCBJcmlzaCwgTmljaG9sYXMgWmFrYXMsIERhdmlkIEtuaWdodC4gRHVhbCBNSVQvQlNEIGxpY2Vuc2Vcclxud2luZG93Lm1hdGNoTWVkaWEgfHwgKHdpbmRvdy5tYXRjaE1lZGlhID0gZnVuY3Rpb24oKSB7XHJcbiAgJ3VzZSBzdHJpY3QnO1xyXG5cclxuICAvLyBGb3IgYnJvd3NlcnMgdGhhdCBzdXBwb3J0IG1hdGNoTWVkaXVtIGFwaSBzdWNoIGFzIElFIDkgYW5kIHdlYmtpdFxyXG4gIHZhciBzdHlsZU1lZGlhID0gKHdpbmRvdy5zdHlsZU1lZGlhIHx8IHdpbmRvdy5tZWRpYSk7XHJcblxyXG4gIC8vIEZvciB0aG9zZSB0aGF0IGRvbid0IHN1cHBvcnQgbWF0Y2hNZWRpdW1cclxuICBpZiAoIXN0eWxlTWVkaWEpIHtcclxuICAgIHZhciBzdHlsZSAgID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKSxcclxuICAgIHNjcmlwdCAgICAgID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3NjcmlwdCcpWzBdLFxyXG4gICAgaW5mbyAgICAgICAgPSBudWxsO1xyXG5cclxuICAgIHN0eWxlLnR5cGUgID0gJ3RleHQvY3NzJztcclxuICAgIHN0eWxlLmlkICAgID0gJ21hdGNobWVkaWFqcy10ZXN0JztcclxuXHJcbiAgICBzY3JpcHQgJiYgc2NyaXB0LnBhcmVudE5vZGUgJiYgc2NyaXB0LnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHN0eWxlLCBzY3JpcHQpO1xyXG5cclxuICAgIC8vICdzdHlsZS5jdXJyZW50U3R5bGUnIGlzIHVzZWQgYnkgSUUgPD0gOCBhbmQgJ3dpbmRvdy5nZXRDb21wdXRlZFN0eWxlJyBmb3IgYWxsIG90aGVyIGJyb3dzZXJzXHJcbiAgICBpbmZvID0gKCdnZXRDb21wdXRlZFN0eWxlJyBpbiB3aW5kb3cpICYmIHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKHN0eWxlLCBudWxsKSB8fCBzdHlsZS5jdXJyZW50U3R5bGU7XHJcblxyXG4gICAgc3R5bGVNZWRpYSA9IHtcclxuICAgICAgbWF0Y2hNZWRpdW0obWVkaWEpIHtcclxuICAgICAgICB2YXIgdGV4dCA9IGBAbWVkaWEgJHttZWRpYX17ICNtYXRjaG1lZGlhanMtdGVzdCB7IHdpZHRoOiAxcHg7IH0gfWA7XHJcblxyXG4gICAgICAgIC8vICdzdHlsZS5zdHlsZVNoZWV0JyBpcyB1c2VkIGJ5IElFIDw9IDggYW5kICdzdHlsZS50ZXh0Q29udGVudCcgZm9yIGFsbCBvdGhlciBicm93c2Vyc1xyXG4gICAgICAgIGlmIChzdHlsZS5zdHlsZVNoZWV0KSB7XHJcbiAgICAgICAgICBzdHlsZS5zdHlsZVNoZWV0LmNzc1RleHQgPSB0ZXh0O1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBzdHlsZS50ZXh0Q29udGVudCA9IHRleHQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBUZXN0IGlmIG1lZGlhIHF1ZXJ5IGlzIHRydWUgb3IgZmFsc2VcclxuICAgICAgICByZXR1cm4gaW5mby53aWR0aCA9PT0gJzFweCc7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIHJldHVybiBmdW5jdGlvbihtZWRpYSkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgbWF0Y2hlczogc3R5bGVNZWRpYS5tYXRjaE1lZGl1bShtZWRpYSB8fCAnYWxsJyksXHJcbiAgICAgIG1lZGlhOiBtZWRpYSB8fCAnYWxsJ1xyXG4gICAgfTtcclxuICB9XHJcbn0oKSk7XHJcblxyXG4vLyBUaGFuayB5b3U6IGh0dHBzOi8vZ2l0aHViLmNvbS9zaW5kcmVzb3JodXMvcXVlcnktc3RyaW5nXHJcbmZ1bmN0aW9uIHBhcnNlU3R5bGVUb09iamVjdChzdHIpIHtcclxuICB2YXIgc3R5bGVPYmplY3QgPSB7fTtcclxuXHJcbiAgaWYgKHR5cGVvZiBzdHIgIT09ICdzdHJpbmcnKSB7XHJcbiAgICByZXR1cm4gc3R5bGVPYmplY3Q7XHJcbiAgfVxyXG5cclxuICBzdHIgPSBzdHIudHJpbSgpLnNsaWNlKDEsIC0xKTsgLy8gYnJvd3NlcnMgcmUtcXVvdGUgc3RyaW5nIHN0eWxlIHZhbHVlc1xyXG5cclxuICBpZiAoIXN0cikge1xyXG4gICAgcmV0dXJuIHN0eWxlT2JqZWN0O1xyXG4gIH1cclxuXHJcbiAgc3R5bGVPYmplY3QgPSBzdHIuc3BsaXQoJyYnKS5yZWR1Y2UoZnVuY3Rpb24ocmV0LCBwYXJhbSkge1xyXG4gICAgdmFyIHBhcnRzID0gcGFyYW0ucmVwbGFjZSgvXFwrL2csICcgJykuc3BsaXQoJz0nKTtcclxuICAgIHZhciBrZXkgPSBwYXJ0c1swXTtcclxuICAgIHZhciB2YWwgPSBwYXJ0c1sxXTtcclxuICAgIGtleSA9IGRlY29kZVVSSUNvbXBvbmVudChrZXkpO1xyXG5cclxuICAgIC8vIG1pc3NpbmcgYD1gIHNob3VsZCBiZSBgbnVsbGA6XHJcbiAgICAvLyBodHRwOi8vdzMub3JnL1RSLzIwMTIvV0QtdXJsLTIwMTIwNTI0LyNjb2xsZWN0LXVybC1wYXJhbWV0ZXJzXHJcbiAgICB2YWwgPSB2YWwgPT09IHVuZGVmaW5lZCA/IG51bGwgOiBkZWNvZGVVUklDb21wb25lbnQodmFsKTtcclxuXHJcbiAgICBpZiAoIXJldC5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XHJcbiAgICAgIHJldFtrZXldID0gdmFsO1xyXG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KHJldFtrZXldKSkge1xyXG4gICAgICByZXRba2V5XS5wdXNoKHZhbCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICByZXRba2V5XSA9IFtyZXRba2V5XSwgdmFsXTtcclxuICAgIH1cclxuICAgIHJldHVybiByZXQ7XHJcbiAgfSwge30pO1xyXG5cclxuICByZXR1cm4gc3R5bGVPYmplY3Q7XHJcbn1cclxuXHJcbkZvdW5kYXRpb24uTWVkaWFRdWVyeSA9IE1lZGlhUXVlcnk7XHJcblxyXG59KGpRdWVyeSk7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbiFmdW5jdGlvbigkKSB7XHJcblxyXG4vKipcclxuICogTW90aW9uIG1vZHVsZS5cclxuICogQG1vZHVsZSBmb3VuZGF0aW9uLm1vdGlvblxyXG4gKi9cclxuXHJcbmNvbnN0IGluaXRDbGFzc2VzICAgPSBbJ211aS1lbnRlcicsICdtdWktbGVhdmUnXTtcclxuY29uc3QgYWN0aXZlQ2xhc3NlcyA9IFsnbXVpLWVudGVyLWFjdGl2ZScsICdtdWktbGVhdmUtYWN0aXZlJ107XHJcblxyXG5jb25zdCBNb3Rpb24gPSB7XHJcbiAgYW5pbWF0ZUluOiBmdW5jdGlvbihlbGVtZW50LCBhbmltYXRpb24sIGNiKSB7XHJcbiAgICBhbmltYXRlKHRydWUsIGVsZW1lbnQsIGFuaW1hdGlvbiwgY2IpO1xyXG4gIH0sXHJcblxyXG4gIGFuaW1hdGVPdXQ6IGZ1bmN0aW9uKGVsZW1lbnQsIGFuaW1hdGlvbiwgY2IpIHtcclxuICAgIGFuaW1hdGUoZmFsc2UsIGVsZW1lbnQsIGFuaW1hdGlvbiwgY2IpO1xyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gTW92ZShkdXJhdGlvbiwgZWxlbSwgZm4pe1xyXG4gIHZhciBhbmltLCBwcm9nLCBzdGFydCA9IG51bGw7XHJcbiAgLy8gY29uc29sZS5sb2coJ2NhbGxlZCcpO1xyXG5cclxuICBpZiAoZHVyYXRpb24gPT09IDApIHtcclxuICAgIGZuLmFwcGx5KGVsZW0pO1xyXG4gICAgZWxlbS50cmlnZ2VyKCdmaW5pc2hlZC56Zi5hbmltYXRlJywgW2VsZW1dKS50cmlnZ2VySGFuZGxlcignZmluaXNoZWQuemYuYW5pbWF0ZScsIFtlbGVtXSk7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG5cclxuICBmdW5jdGlvbiBtb3ZlKHRzKXtcclxuICAgIGlmKCFzdGFydCkgc3RhcnQgPSB0cztcclxuICAgIC8vIGNvbnNvbGUubG9nKHN0YXJ0LCB0cyk7XHJcbiAgICBwcm9nID0gdHMgLSBzdGFydDtcclxuICAgIGZuLmFwcGx5KGVsZW0pO1xyXG5cclxuICAgIGlmKHByb2cgPCBkdXJhdGlvbil7IGFuaW0gPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKG1vdmUsIGVsZW0pOyB9XHJcbiAgICBlbHNle1xyXG4gICAgICB3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUoYW5pbSk7XHJcbiAgICAgIGVsZW0udHJpZ2dlcignZmluaXNoZWQuemYuYW5pbWF0ZScsIFtlbGVtXSkudHJpZ2dlckhhbmRsZXIoJ2ZpbmlzaGVkLnpmLmFuaW1hdGUnLCBbZWxlbV0pO1xyXG4gICAgfVxyXG4gIH1cclxuICBhbmltID0gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZShtb3ZlKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEFuaW1hdGVzIGFuIGVsZW1lbnQgaW4gb3Igb3V0IHVzaW5nIGEgQ1NTIHRyYW5zaXRpb24gY2xhc3MuXHJcbiAqIEBmdW5jdGlvblxyXG4gKiBAcHJpdmF0ZVxyXG4gKiBAcGFyYW0ge0Jvb2xlYW59IGlzSW4gLSBEZWZpbmVzIGlmIHRoZSBhbmltYXRpb24gaXMgaW4gb3Igb3V0LlxyXG4gKiBAcGFyYW0ge09iamVjdH0gZWxlbWVudCAtIGpRdWVyeSBvciBIVE1MIG9iamVjdCB0byBhbmltYXRlLlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gYW5pbWF0aW9uIC0gQ1NTIGNsYXNzIHRvIHVzZS5cclxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2IgLSBDYWxsYmFjayB0byBydW4gd2hlbiBhbmltYXRpb24gaXMgZmluaXNoZWQuXHJcbiAqL1xyXG5mdW5jdGlvbiBhbmltYXRlKGlzSW4sIGVsZW1lbnQsIGFuaW1hdGlvbiwgY2IpIHtcclxuICBlbGVtZW50ID0gJChlbGVtZW50KS5lcSgwKTtcclxuXHJcbiAgaWYgKCFlbGVtZW50Lmxlbmd0aCkgcmV0dXJuO1xyXG5cclxuICB2YXIgaW5pdENsYXNzID0gaXNJbiA/IGluaXRDbGFzc2VzWzBdIDogaW5pdENsYXNzZXNbMV07XHJcbiAgdmFyIGFjdGl2ZUNsYXNzID0gaXNJbiA/IGFjdGl2ZUNsYXNzZXNbMF0gOiBhY3RpdmVDbGFzc2VzWzFdO1xyXG5cclxuICAvLyBTZXQgdXAgdGhlIGFuaW1hdGlvblxyXG4gIHJlc2V0KCk7XHJcblxyXG4gIGVsZW1lbnRcclxuICAgIC5hZGRDbGFzcyhhbmltYXRpb24pXHJcbiAgICAuY3NzKCd0cmFuc2l0aW9uJywgJ25vbmUnKTtcclxuXHJcbiAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHtcclxuICAgIGVsZW1lbnQuYWRkQ2xhc3MoaW5pdENsYXNzKTtcclxuICAgIGlmIChpc0luKSBlbGVtZW50LnNob3coKTtcclxuICB9KTtcclxuXHJcbiAgLy8gU3RhcnQgdGhlIGFuaW1hdGlvblxyXG4gIHJlcXVlc3RBbmltYXRpb25GcmFtZSgoKSA9PiB7XHJcbiAgICBlbGVtZW50WzBdLm9mZnNldFdpZHRoO1xyXG4gICAgZWxlbWVudFxyXG4gICAgICAuY3NzKCd0cmFuc2l0aW9uJywgJycpXHJcbiAgICAgIC5hZGRDbGFzcyhhY3RpdmVDbGFzcyk7XHJcbiAgfSk7XHJcblxyXG4gIC8vIENsZWFuIHVwIHRoZSBhbmltYXRpb24gd2hlbiBpdCBmaW5pc2hlc1xyXG4gIGVsZW1lbnQub25lKEZvdW5kYXRpb24udHJhbnNpdGlvbmVuZChlbGVtZW50KSwgZmluaXNoKTtcclxuXHJcbiAgLy8gSGlkZXMgdGhlIGVsZW1lbnQgKGZvciBvdXQgYW5pbWF0aW9ucyksIHJlc2V0cyB0aGUgZWxlbWVudCwgYW5kIHJ1bnMgYSBjYWxsYmFja1xyXG4gIGZ1bmN0aW9uIGZpbmlzaCgpIHtcclxuICAgIGlmICghaXNJbikgZWxlbWVudC5oaWRlKCk7XHJcbiAgICByZXNldCgpO1xyXG4gICAgaWYgKGNiKSBjYi5hcHBseShlbGVtZW50KTtcclxuICB9XHJcblxyXG4gIC8vIFJlc2V0cyB0cmFuc2l0aW9ucyBhbmQgcmVtb3ZlcyBtb3Rpb24tc3BlY2lmaWMgY2xhc3Nlc1xyXG4gIGZ1bmN0aW9uIHJlc2V0KCkge1xyXG4gICAgZWxlbWVudFswXS5zdHlsZS50cmFuc2l0aW9uRHVyYXRpb24gPSAwO1xyXG4gICAgZWxlbWVudC5yZW1vdmVDbGFzcyhgJHtpbml0Q2xhc3N9ICR7YWN0aXZlQ2xhc3N9ICR7YW5pbWF0aW9ufWApO1xyXG4gIH1cclxufVxyXG5cclxuRm91bmRhdGlvbi5Nb3ZlID0gTW92ZTtcclxuRm91bmRhdGlvbi5Nb3Rpb24gPSBNb3Rpb247XHJcblxyXG59KGpRdWVyeSk7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbiFmdW5jdGlvbigkKSB7XHJcblxyXG5jb25zdCBOZXN0ID0ge1xyXG4gIEZlYXRoZXIobWVudSwgdHlwZSA9ICd6ZicpIHtcclxuICAgIG1lbnUuYXR0cigncm9sZScsICdtZW51YmFyJyk7XHJcblxyXG4gICAgdmFyIGl0ZW1zID0gbWVudS5maW5kKCdsaScpLmF0dHIoeydyb2xlJzogJ21lbnVpdGVtJ30pLFxyXG4gICAgICAgIHN1Yk1lbnVDbGFzcyA9IGBpcy0ke3R5cGV9LXN1Ym1lbnVgLFxyXG4gICAgICAgIHN1Ykl0ZW1DbGFzcyA9IGAke3N1Yk1lbnVDbGFzc30taXRlbWAsXHJcbiAgICAgICAgaGFzU3ViQ2xhc3MgPSBgaXMtJHt0eXBlfS1zdWJtZW51LXBhcmVudGA7XHJcblxyXG4gICAgaXRlbXMuZWFjaChmdW5jdGlvbigpIHtcclxuICAgICAgdmFyICRpdGVtID0gJCh0aGlzKSxcclxuICAgICAgICAgICRzdWIgPSAkaXRlbS5jaGlsZHJlbigndWwnKTtcclxuXHJcbiAgICAgIGlmICgkc3ViLmxlbmd0aCkge1xyXG4gICAgICAgICRpdGVtXHJcbiAgICAgICAgICAuYWRkQ2xhc3MoaGFzU3ViQ2xhc3MpXHJcbiAgICAgICAgICAuYXR0cih7XHJcbiAgICAgICAgICAgICdhcmlhLWhhc3BvcHVwJzogdHJ1ZSxcclxuICAgICAgICAgICAgJ2FyaWEtbGFiZWwnOiAkaXRlbS5jaGlsZHJlbignYTpmaXJzdCcpLnRleHQoKVxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgICAvLyBOb3RlOiAgRHJpbGxkb3ducyBiZWhhdmUgZGlmZmVyZW50bHkgaW4gaG93IHRoZXkgaGlkZSwgYW5kIHNvIG5lZWRcclxuICAgICAgICAgIC8vIGFkZGl0aW9uYWwgYXR0cmlidXRlcy4gIFdlIHNob3VsZCBsb29rIGlmIHRoaXMgcG9zc2libHkgb3Zlci1nZW5lcmFsaXplZFxyXG4gICAgICAgICAgLy8gdXRpbGl0eSAoTmVzdCkgaXMgYXBwcm9wcmlhdGUgd2hlbiB3ZSByZXdvcmsgbWVudXMgaW4gNi40XHJcbiAgICAgICAgICBpZih0eXBlID09PSAnZHJpbGxkb3duJykge1xyXG4gICAgICAgICAgICAkaXRlbS5hdHRyKHsnYXJpYS1leHBhbmRlZCc6IGZhbHNlfSk7XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICRzdWJcclxuICAgICAgICAgIC5hZGRDbGFzcyhgc3VibWVudSAke3N1Yk1lbnVDbGFzc31gKVxyXG4gICAgICAgICAgLmF0dHIoe1xyXG4gICAgICAgICAgICAnZGF0YS1zdWJtZW51JzogJycsXHJcbiAgICAgICAgICAgICdyb2xlJzogJ21lbnUnXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICBpZih0eXBlID09PSAnZHJpbGxkb3duJykge1xyXG4gICAgICAgICAgJHN1Yi5hdHRyKHsnYXJpYS1oaWRkZW4nOiB0cnVlfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoJGl0ZW0ucGFyZW50KCdbZGF0YS1zdWJtZW51XScpLmxlbmd0aCkge1xyXG4gICAgICAgICRpdGVtLmFkZENsYXNzKGBpcy1zdWJtZW51LWl0ZW0gJHtzdWJJdGVtQ2xhc3N9YCk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybjtcclxuICB9LFxyXG5cclxuICBCdXJuKG1lbnUsIHR5cGUpIHtcclxuICAgIHZhciAvL2l0ZW1zID0gbWVudS5maW5kKCdsaScpLFxyXG4gICAgICAgIHN1Yk1lbnVDbGFzcyA9IGBpcy0ke3R5cGV9LXN1Ym1lbnVgLFxyXG4gICAgICAgIHN1Ykl0ZW1DbGFzcyA9IGAke3N1Yk1lbnVDbGFzc30taXRlbWAsXHJcbiAgICAgICAgaGFzU3ViQ2xhc3MgPSBgaXMtJHt0eXBlfS1zdWJtZW51LXBhcmVudGA7XHJcblxyXG4gICAgbWVudVxyXG4gICAgICAuZmluZCgnPmxpLCAubWVudSwgLm1lbnUgPiBsaScpXHJcbiAgICAgIC5yZW1vdmVDbGFzcyhgJHtzdWJNZW51Q2xhc3N9ICR7c3ViSXRlbUNsYXNzfSAke2hhc1N1YkNsYXNzfSBpcy1zdWJtZW51LWl0ZW0gc3VibWVudSBpcy1hY3RpdmVgKVxyXG4gICAgICAucmVtb3ZlQXR0cignZGF0YS1zdWJtZW51JykuY3NzKCdkaXNwbGF5JywgJycpO1xyXG5cclxuICAgIC8vIGNvbnNvbGUubG9nKCAgICAgIG1lbnUuZmluZCgnLicgKyBzdWJNZW51Q2xhc3MgKyAnLCAuJyArIHN1Ykl0ZW1DbGFzcyArICcsIC5oYXMtc3VibWVudSwgLmlzLXN1Ym1lbnUtaXRlbSwgLnN1Ym1lbnUsIFtkYXRhLXN1Ym1lbnVdJylcclxuICAgIC8vICAgICAgICAgICAucmVtb3ZlQ2xhc3Moc3ViTWVudUNsYXNzICsgJyAnICsgc3ViSXRlbUNsYXNzICsgJyBoYXMtc3VibWVudSBpcy1zdWJtZW51LWl0ZW0gc3VibWVudScpXHJcbiAgICAvLyAgICAgICAgICAgLnJlbW92ZUF0dHIoJ2RhdGEtc3VibWVudScpKTtcclxuICAgIC8vIGl0ZW1zLmVhY2goZnVuY3Rpb24oKXtcclxuICAgIC8vICAgdmFyICRpdGVtID0gJCh0aGlzKSxcclxuICAgIC8vICAgICAgICRzdWIgPSAkaXRlbS5jaGlsZHJlbigndWwnKTtcclxuICAgIC8vICAgaWYoJGl0ZW0ucGFyZW50KCdbZGF0YS1zdWJtZW51XScpLmxlbmd0aCl7XHJcbiAgICAvLyAgICAgJGl0ZW0ucmVtb3ZlQ2xhc3MoJ2lzLXN1Ym1lbnUtaXRlbSAnICsgc3ViSXRlbUNsYXNzKTtcclxuICAgIC8vICAgfVxyXG4gICAgLy8gICBpZigkc3ViLmxlbmd0aCl7XHJcbiAgICAvLyAgICAgJGl0ZW0ucmVtb3ZlQ2xhc3MoJ2hhcy1zdWJtZW51Jyk7XHJcbiAgICAvLyAgICAgJHN1Yi5yZW1vdmVDbGFzcygnc3VibWVudSAnICsgc3ViTWVudUNsYXNzKS5yZW1vdmVBdHRyKCdkYXRhLXN1Ym1lbnUnKTtcclxuICAgIC8vICAgfVxyXG4gICAgLy8gfSk7XHJcbiAgfVxyXG59XHJcblxyXG5Gb3VuZGF0aW9uLk5lc3QgPSBOZXN0O1xyXG5cclxufShqUXVlcnkpO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG4hZnVuY3Rpb24oJCkge1xyXG5cclxuZnVuY3Rpb24gVGltZXIoZWxlbSwgb3B0aW9ucywgY2IpIHtcclxuICB2YXIgX3RoaXMgPSB0aGlzLFxyXG4gICAgICBkdXJhdGlvbiA9IG9wdGlvbnMuZHVyYXRpb24sLy9vcHRpb25zIGlzIGFuIG9iamVjdCBmb3IgZWFzaWx5IGFkZGluZyBmZWF0dXJlcyBsYXRlci5cclxuICAgICAgbmFtZVNwYWNlID0gT2JqZWN0LmtleXMoZWxlbS5kYXRhKCkpWzBdIHx8ICd0aW1lcicsXHJcbiAgICAgIHJlbWFpbiA9IC0xLFxyXG4gICAgICBzdGFydCxcclxuICAgICAgdGltZXI7XHJcblxyXG4gIHRoaXMuaXNQYXVzZWQgPSBmYWxzZTtcclxuXHJcbiAgdGhpcy5yZXN0YXJ0ID0gZnVuY3Rpb24oKSB7XHJcbiAgICByZW1haW4gPSAtMTtcclxuICAgIGNsZWFyVGltZW91dCh0aW1lcik7XHJcbiAgICB0aGlzLnN0YXJ0KCk7XHJcbiAgfVxyXG5cclxuICB0aGlzLnN0YXJ0ID0gZnVuY3Rpb24oKSB7XHJcbiAgICB0aGlzLmlzUGF1c2VkID0gZmFsc2U7XHJcbiAgICAvLyBpZighZWxlbS5kYXRhKCdwYXVzZWQnKSl7IHJldHVybiBmYWxzZTsgfS8vbWF5YmUgaW1wbGVtZW50IHRoaXMgc2FuaXR5IGNoZWNrIGlmIHVzZWQgZm9yIG90aGVyIHRoaW5ncy5cclxuICAgIGNsZWFyVGltZW91dCh0aW1lcik7XHJcbiAgICByZW1haW4gPSByZW1haW4gPD0gMCA/IGR1cmF0aW9uIDogcmVtYWluO1xyXG4gICAgZWxlbS5kYXRhKCdwYXVzZWQnLCBmYWxzZSk7XHJcbiAgICBzdGFydCA9IERhdGUubm93KCk7XHJcbiAgICB0aW1lciA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcclxuICAgICAgaWYob3B0aW9ucy5pbmZpbml0ZSl7XHJcbiAgICAgICAgX3RoaXMucmVzdGFydCgpOy8vcmVydW4gdGhlIHRpbWVyLlxyXG4gICAgICB9XHJcbiAgICAgIGlmIChjYiAmJiB0eXBlb2YgY2IgPT09ICdmdW5jdGlvbicpIHsgY2IoKTsgfVxyXG4gICAgfSwgcmVtYWluKTtcclxuICAgIGVsZW0udHJpZ2dlcihgdGltZXJzdGFydC56Zi4ke25hbWVTcGFjZX1gKTtcclxuICB9XHJcblxyXG4gIHRoaXMucGF1c2UgPSBmdW5jdGlvbigpIHtcclxuICAgIHRoaXMuaXNQYXVzZWQgPSB0cnVlO1xyXG4gICAgLy9pZihlbGVtLmRhdGEoJ3BhdXNlZCcpKXsgcmV0dXJuIGZhbHNlOyB9Ly9tYXliZSBpbXBsZW1lbnQgdGhpcyBzYW5pdHkgY2hlY2sgaWYgdXNlZCBmb3Igb3RoZXIgdGhpbmdzLlxyXG4gICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcclxuICAgIGVsZW0uZGF0YSgncGF1c2VkJywgdHJ1ZSk7XHJcbiAgICB2YXIgZW5kID0gRGF0ZS5ub3coKTtcclxuICAgIHJlbWFpbiA9IHJlbWFpbiAtIChlbmQgLSBzdGFydCk7XHJcbiAgICBlbGVtLnRyaWdnZXIoYHRpbWVycGF1c2VkLnpmLiR7bmFtZVNwYWNlfWApO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIFJ1bnMgYSBjYWxsYmFjayBmdW5jdGlvbiB3aGVuIGltYWdlcyBhcmUgZnVsbHkgbG9hZGVkLlxyXG4gKiBAcGFyYW0ge09iamVjdH0gaW1hZ2VzIC0gSW1hZ2UocykgdG8gY2hlY2sgaWYgbG9hZGVkLlxyXG4gKiBAcGFyYW0ge0Z1bmN9IGNhbGxiYWNrIC0gRnVuY3Rpb24gdG8gZXhlY3V0ZSB3aGVuIGltYWdlIGlzIGZ1bGx5IGxvYWRlZC5cclxuICovXHJcbmZ1bmN0aW9uIG9uSW1hZ2VzTG9hZGVkKGltYWdlcywgY2FsbGJhY2spe1xyXG4gIHZhciBzZWxmID0gdGhpcyxcclxuICAgICAgdW5sb2FkZWQgPSBpbWFnZXMubGVuZ3RoO1xyXG5cclxuICBpZiAodW5sb2FkZWQgPT09IDApIHtcclxuICAgIGNhbGxiYWNrKCk7XHJcbiAgfVxyXG5cclxuICBpbWFnZXMuZWFjaChmdW5jdGlvbigpIHtcclxuICAgIC8vIENoZWNrIGlmIGltYWdlIGlzIGxvYWRlZFxyXG4gICAgaWYgKHRoaXMuY29tcGxldGUgfHwgKHRoaXMucmVhZHlTdGF0ZSA9PT0gNCkgfHwgKHRoaXMucmVhZHlTdGF0ZSA9PT0gJ2NvbXBsZXRlJykpIHtcclxuICAgICAgc2luZ2xlSW1hZ2VMb2FkZWQoKTtcclxuICAgIH1cclxuICAgIC8vIEZvcmNlIGxvYWQgdGhlIGltYWdlXHJcbiAgICBlbHNlIHtcclxuICAgICAgLy8gZml4IGZvciBJRS4gU2VlIGh0dHBzOi8vY3NzLXRyaWNrcy5jb20vc25pcHBldHMvanF1ZXJ5L2ZpeGluZy1sb2FkLWluLWllLWZvci1jYWNoZWQtaW1hZ2VzL1xyXG4gICAgICB2YXIgc3JjID0gJCh0aGlzKS5hdHRyKCdzcmMnKTtcclxuICAgICAgJCh0aGlzKS5hdHRyKCdzcmMnLCBzcmMgKyAnPycgKyAobmV3IERhdGUoKS5nZXRUaW1lKCkpKTtcclxuICAgICAgJCh0aGlzKS5vbmUoJ2xvYWQnLCBmdW5jdGlvbigpIHtcclxuICAgICAgICBzaW5nbGVJbWFnZUxvYWRlZCgpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9KTtcclxuXHJcbiAgZnVuY3Rpb24gc2luZ2xlSW1hZ2VMb2FkZWQoKSB7XHJcbiAgICB1bmxvYWRlZC0tO1xyXG4gICAgaWYgKHVubG9hZGVkID09PSAwKSB7XHJcbiAgICAgIGNhbGxiYWNrKCk7XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcblxyXG5Gb3VuZGF0aW9uLlRpbWVyID0gVGltZXI7XHJcbkZvdW5kYXRpb24ub25JbWFnZXNMb2FkZWQgPSBvbkltYWdlc0xvYWRlZDtcclxuXHJcbn0oalF1ZXJ5KTtcclxuIiwiLy8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG4vLyoqV29yayBpbnNwaXJlZCBieSBtdWx0aXBsZSBqcXVlcnkgc3dpcGUgcGx1Z2lucyoqXHJcbi8vKipEb25lIGJ5IFlvaGFpIEFyYXJhdCAqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuLy8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG4oZnVuY3Rpb24oJCkge1xyXG5cclxuICAkLnNwb3RTd2lwZSA9IHtcclxuICAgIHZlcnNpb246ICcxLjAuMCcsXHJcbiAgICBlbmFibGVkOiAnb250b3VjaHN0YXJ0JyBpbiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQsXHJcbiAgICBwcmV2ZW50RGVmYXVsdDogZmFsc2UsXHJcbiAgICBtb3ZlVGhyZXNob2xkOiA3NSxcclxuICAgIHRpbWVUaHJlc2hvbGQ6IDIwMFxyXG4gIH07XHJcblxyXG4gIHZhciAgIHN0YXJ0UG9zWCxcclxuICAgICAgICBzdGFydFBvc1ksXHJcbiAgICAgICAgc3RhcnRUaW1lLFxyXG4gICAgICAgIGVsYXBzZWRUaW1lLFxyXG4gICAgICAgIGlzTW92aW5nID0gZmFsc2U7XHJcblxyXG4gIGZ1bmN0aW9uIG9uVG91Y2hFbmQoKSB7XHJcbiAgICAvLyAgYWxlcnQodGhpcyk7XHJcbiAgICB0aGlzLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIG9uVG91Y2hNb3ZlKTtcclxuICAgIHRoaXMucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2hlbmQnLCBvblRvdWNoRW5kKTtcclxuICAgIGlzTW92aW5nID0gZmFsc2U7XHJcbiAgfVxyXG5cclxuICBmdW5jdGlvbiBvblRvdWNoTW92ZShlKSB7XHJcbiAgICBpZiAoJC5zcG90U3dpcGUucHJldmVudERlZmF1bHQpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyB9XHJcbiAgICBpZihpc01vdmluZykge1xyXG4gICAgICB2YXIgeCA9IGUudG91Y2hlc1swXS5wYWdlWDtcclxuICAgICAgdmFyIHkgPSBlLnRvdWNoZXNbMF0ucGFnZVk7XHJcbiAgICAgIHZhciBkeCA9IHN0YXJ0UG9zWCAtIHg7XHJcbiAgICAgIHZhciBkeSA9IHN0YXJ0UG9zWSAtIHk7XHJcbiAgICAgIHZhciBkaXI7XHJcbiAgICAgIGVsYXBzZWRUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgLSBzdGFydFRpbWU7XHJcbiAgICAgIGlmKE1hdGguYWJzKGR4KSA+PSAkLnNwb3RTd2lwZS5tb3ZlVGhyZXNob2xkICYmIGVsYXBzZWRUaW1lIDw9ICQuc3BvdFN3aXBlLnRpbWVUaHJlc2hvbGQpIHtcclxuICAgICAgICBkaXIgPSBkeCA+IDAgPyAnbGVmdCcgOiAncmlnaHQnO1xyXG4gICAgICB9XHJcbiAgICAgIC8vIGVsc2UgaWYoTWF0aC5hYnMoZHkpID49ICQuc3BvdFN3aXBlLm1vdmVUaHJlc2hvbGQgJiYgZWxhcHNlZFRpbWUgPD0gJC5zcG90U3dpcGUudGltZVRocmVzaG9sZCkge1xyXG4gICAgICAvLyAgIGRpciA9IGR5ID4gMCA/ICdkb3duJyA6ICd1cCc7XHJcbiAgICAgIC8vIH1cclxuICAgICAgaWYoZGlyKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIG9uVG91Y2hFbmQuY2FsbCh0aGlzKTtcclxuICAgICAgICAkKHRoaXMpLnRyaWdnZXIoJ3N3aXBlJywgZGlyKS50cmlnZ2VyKGBzd2lwZSR7ZGlyfWApO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBmdW5jdGlvbiBvblRvdWNoU3RhcnQoZSkge1xyXG4gICAgaWYgKGUudG91Y2hlcy5sZW5ndGggPT0gMSkge1xyXG4gICAgICBzdGFydFBvc1ggPSBlLnRvdWNoZXNbMF0ucGFnZVg7XHJcbiAgICAgIHN0YXJ0UG9zWSA9IGUudG91Y2hlc1swXS5wYWdlWTtcclxuICAgICAgaXNNb3ZpbmcgPSB0cnVlO1xyXG4gICAgICBzdGFydFRpbWUgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcclxuICAgICAgdGhpcy5hZGRFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCBvblRvdWNoTW92ZSwgZmFsc2UpO1xyXG4gICAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoZW5kJywgb25Ub3VjaEVuZCwgZmFsc2UpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgZnVuY3Rpb24gaW5pdCgpIHtcclxuICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lciAmJiB0aGlzLmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCBvblRvdWNoU3RhcnQsIGZhbHNlKTtcclxuICB9XHJcblxyXG4gIGZ1bmN0aW9uIHRlYXJkb3duKCkge1xyXG4gICAgdGhpcy5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0Jywgb25Ub3VjaFN0YXJ0KTtcclxuICB9XHJcblxyXG4gICQuZXZlbnQuc3BlY2lhbC5zd2lwZSA9IHsgc2V0dXA6IGluaXQgfTtcclxuXHJcbiAgJC5lYWNoKFsnbGVmdCcsICd1cCcsICdkb3duJywgJ3JpZ2h0J10sIGZ1bmN0aW9uICgpIHtcclxuICAgICQuZXZlbnQuc3BlY2lhbFtgc3dpcGUke3RoaXN9YF0gPSB7IHNldHVwOiBmdW5jdGlvbigpe1xyXG4gICAgICAkKHRoaXMpLm9uKCdzd2lwZScsICQubm9vcCk7XHJcbiAgICB9IH07XHJcbiAgfSk7XHJcbn0pKGpRdWVyeSk7XHJcbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbiAqIE1ldGhvZCBmb3IgYWRkaW5nIHBzdWVkbyBkcmFnIGV2ZW50cyB0byBlbGVtZW50cyAqXHJcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXHJcbiFmdW5jdGlvbigkKXtcclxuICAkLmZuLmFkZFRvdWNoID0gZnVuY3Rpb24oKXtcclxuICAgIHRoaXMuZWFjaChmdW5jdGlvbihpLGVsKXtcclxuICAgICAgJChlbCkuYmluZCgndG91Y2hzdGFydCB0b3VjaG1vdmUgdG91Y2hlbmQgdG91Y2hjYW5jZWwnLGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgLy93ZSBwYXNzIHRoZSBvcmlnaW5hbCBldmVudCBvYmplY3QgYmVjYXVzZSB0aGUgalF1ZXJ5IGV2ZW50XHJcbiAgICAgICAgLy9vYmplY3QgaXMgbm9ybWFsaXplZCB0byB3M2Mgc3BlY3MgYW5kIGRvZXMgbm90IHByb3ZpZGUgdGhlIFRvdWNoTGlzdFxyXG4gICAgICAgIGhhbmRsZVRvdWNoKGV2ZW50KTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB2YXIgaGFuZGxlVG91Y2ggPSBmdW5jdGlvbihldmVudCl7XHJcbiAgICAgIHZhciB0b3VjaGVzID0gZXZlbnQuY2hhbmdlZFRvdWNoZXMsXHJcbiAgICAgICAgICBmaXJzdCA9IHRvdWNoZXNbMF0sXHJcbiAgICAgICAgICBldmVudFR5cGVzID0ge1xyXG4gICAgICAgICAgICB0b3VjaHN0YXJ0OiAnbW91c2Vkb3duJyxcclxuICAgICAgICAgICAgdG91Y2htb3ZlOiAnbW91c2Vtb3ZlJyxcclxuICAgICAgICAgICAgdG91Y2hlbmQ6ICdtb3VzZXVwJ1xyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHR5cGUgPSBldmVudFR5cGVzW2V2ZW50LnR5cGVdLFxyXG4gICAgICAgICAgc2ltdWxhdGVkRXZlbnRcclxuICAgICAgICA7XHJcblxyXG4gICAgICBpZignTW91c2VFdmVudCcgaW4gd2luZG93ICYmIHR5cGVvZiB3aW5kb3cuTW91c2VFdmVudCA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgIHNpbXVsYXRlZEV2ZW50ID0gbmV3IHdpbmRvdy5Nb3VzZUV2ZW50KHR5cGUsIHtcclxuICAgICAgICAgICdidWJibGVzJzogdHJ1ZSxcclxuICAgICAgICAgICdjYW5jZWxhYmxlJzogdHJ1ZSxcclxuICAgICAgICAgICdzY3JlZW5YJzogZmlyc3Quc2NyZWVuWCxcclxuICAgICAgICAgICdzY3JlZW5ZJzogZmlyc3Quc2NyZWVuWSxcclxuICAgICAgICAgICdjbGllbnRYJzogZmlyc3QuY2xpZW50WCxcclxuICAgICAgICAgICdjbGllbnRZJzogZmlyc3QuY2xpZW50WVxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHNpbXVsYXRlZEV2ZW50ID0gZG9jdW1lbnQuY3JlYXRlRXZlbnQoJ01vdXNlRXZlbnQnKTtcclxuICAgICAgICBzaW11bGF0ZWRFdmVudC5pbml0TW91c2VFdmVudCh0eXBlLCB0cnVlLCB0cnVlLCB3aW5kb3csIDEsIGZpcnN0LnNjcmVlblgsIGZpcnN0LnNjcmVlblksIGZpcnN0LmNsaWVudFgsIGZpcnN0LmNsaWVudFksIGZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlLCAwLypsZWZ0Ki8sIG51bGwpO1xyXG4gICAgICB9XHJcbiAgICAgIGZpcnN0LnRhcmdldC5kaXNwYXRjaEV2ZW50KHNpbXVsYXRlZEV2ZW50KTtcclxuICAgIH07XHJcbiAgfTtcclxufShqUXVlcnkpO1xyXG5cclxuXHJcbi8vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG4vLyoqRnJvbSB0aGUgalF1ZXJ5IE1vYmlsZSBMaWJyYXJ5KipcclxuLy8qKm5lZWQgdG8gcmVjcmVhdGUgZnVuY3Rpb25hbGl0eSoqXHJcbi8vKiphbmQgdHJ5IHRvIGltcHJvdmUgaWYgcG9zc2libGUqKlxyXG4vLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuXHJcbi8qIFJlbW92aW5nIHRoZSBqUXVlcnkgZnVuY3Rpb24gKioqKlxyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuXHJcbihmdW5jdGlvbiggJCwgd2luZG93LCB1bmRlZmluZWQgKSB7XHJcblxyXG5cdHZhciAkZG9jdW1lbnQgPSAkKCBkb2N1bWVudCApLFxyXG5cdFx0Ly8gc3VwcG9ydFRvdWNoID0gJC5tb2JpbGUuc3VwcG9ydC50b3VjaCxcclxuXHRcdHRvdWNoU3RhcnRFdmVudCA9ICd0b3VjaHN0YXJ0Jy8vc3VwcG9ydFRvdWNoID8gXCJ0b3VjaHN0YXJ0XCIgOiBcIm1vdXNlZG93blwiLFxyXG5cdFx0dG91Y2hTdG9wRXZlbnQgPSAndG91Y2hlbmQnLy9zdXBwb3J0VG91Y2ggPyBcInRvdWNoZW5kXCIgOiBcIm1vdXNldXBcIixcclxuXHRcdHRvdWNoTW92ZUV2ZW50ID0gJ3RvdWNobW92ZScvL3N1cHBvcnRUb3VjaCA/IFwidG91Y2htb3ZlXCIgOiBcIm1vdXNlbW92ZVwiO1xyXG5cclxuXHQvLyBzZXR1cCBuZXcgZXZlbnQgc2hvcnRjdXRzXHJcblx0JC5lYWNoKCAoIFwidG91Y2hzdGFydCB0b3VjaG1vdmUgdG91Y2hlbmQgXCIgK1xyXG5cdFx0XCJzd2lwZSBzd2lwZWxlZnQgc3dpcGVyaWdodFwiICkuc3BsaXQoIFwiIFwiICksIGZ1bmN0aW9uKCBpLCBuYW1lICkge1xyXG5cclxuXHRcdCQuZm5bIG5hbWUgXSA9IGZ1bmN0aW9uKCBmbiApIHtcclxuXHRcdFx0cmV0dXJuIGZuID8gdGhpcy5iaW5kKCBuYW1lLCBmbiApIDogdGhpcy50cmlnZ2VyKCBuYW1lICk7XHJcblx0XHR9O1xyXG5cclxuXHRcdC8vIGpRdWVyeSA8IDEuOFxyXG5cdFx0aWYgKCAkLmF0dHJGbiApIHtcclxuXHRcdFx0JC5hdHRyRm5bIG5hbWUgXSA9IHRydWU7XHJcblx0XHR9XHJcblx0fSk7XHJcblxyXG5cdGZ1bmN0aW9uIHRyaWdnZXJDdXN0b21FdmVudCggb2JqLCBldmVudFR5cGUsIGV2ZW50LCBidWJibGUgKSB7XHJcblx0XHR2YXIgb3JpZ2luYWxUeXBlID0gZXZlbnQudHlwZTtcclxuXHRcdGV2ZW50LnR5cGUgPSBldmVudFR5cGU7XHJcblx0XHRpZiAoIGJ1YmJsZSApIHtcclxuXHRcdFx0JC5ldmVudC50cmlnZ2VyKCBldmVudCwgdW5kZWZpbmVkLCBvYmogKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdCQuZXZlbnQuZGlzcGF0Y2guY2FsbCggb2JqLCBldmVudCApO1xyXG5cdFx0fVxyXG5cdFx0ZXZlbnQudHlwZSA9IG9yaWdpbmFsVHlwZTtcclxuXHR9XHJcblxyXG5cdC8vIGFsc28gaGFuZGxlcyB0YXBob2xkXHJcblxyXG5cdC8vIEFsc28gaGFuZGxlcyBzd2lwZWxlZnQsIHN3aXBlcmlnaHRcclxuXHQkLmV2ZW50LnNwZWNpYWwuc3dpcGUgPSB7XHJcblxyXG5cdFx0Ly8gTW9yZSB0aGFuIHRoaXMgaG9yaXpvbnRhbCBkaXNwbGFjZW1lbnQsIGFuZCB3ZSB3aWxsIHN1cHByZXNzIHNjcm9sbGluZy5cclxuXHRcdHNjcm9sbFN1cHJlc3Npb25UaHJlc2hvbGQ6IDMwLFxyXG5cclxuXHRcdC8vIE1vcmUgdGltZSB0aGFuIHRoaXMsIGFuZCBpdCBpc24ndCBhIHN3aXBlLlxyXG5cdFx0ZHVyYXRpb25UaHJlc2hvbGQ6IDEwMDAsXHJcblxyXG5cdFx0Ly8gU3dpcGUgaG9yaXpvbnRhbCBkaXNwbGFjZW1lbnQgbXVzdCBiZSBtb3JlIHRoYW4gdGhpcy5cclxuXHRcdGhvcml6b250YWxEaXN0YW5jZVRocmVzaG9sZDogd2luZG93LmRldmljZVBpeGVsUmF0aW8gPj0gMiA/IDE1IDogMzAsXHJcblxyXG5cdFx0Ly8gU3dpcGUgdmVydGljYWwgZGlzcGxhY2VtZW50IG11c3QgYmUgbGVzcyB0aGFuIHRoaXMuXHJcblx0XHR2ZXJ0aWNhbERpc3RhbmNlVGhyZXNob2xkOiB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbyA+PSAyID8gMTUgOiAzMCxcclxuXHJcblx0XHRnZXRMb2NhdGlvbjogZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdFx0dmFyIHdpblBhZ2VYID0gd2luZG93LnBhZ2VYT2Zmc2V0LFxyXG5cdFx0XHRcdHdpblBhZ2VZID0gd2luZG93LnBhZ2VZT2Zmc2V0LFxyXG5cdFx0XHRcdHggPSBldmVudC5jbGllbnRYLFxyXG5cdFx0XHRcdHkgPSBldmVudC5jbGllbnRZO1xyXG5cclxuXHRcdFx0aWYgKCBldmVudC5wYWdlWSA9PT0gMCAmJiBNYXRoLmZsb29yKCB5ICkgPiBNYXRoLmZsb29yKCBldmVudC5wYWdlWSApIHx8XHJcblx0XHRcdFx0ZXZlbnQucGFnZVggPT09IDAgJiYgTWF0aC5mbG9vciggeCApID4gTWF0aC5mbG9vciggZXZlbnQucGFnZVggKSApIHtcclxuXHJcblx0XHRcdFx0Ly8gaU9TNCBjbGllbnRYL2NsaWVudFkgaGF2ZSB0aGUgdmFsdWUgdGhhdCBzaG91bGQgaGF2ZSBiZWVuXHJcblx0XHRcdFx0Ly8gaW4gcGFnZVgvcGFnZVkuIFdoaWxlIHBhZ2VYL3BhZ2UvIGhhdmUgdGhlIHZhbHVlIDBcclxuXHRcdFx0XHR4ID0geCAtIHdpblBhZ2VYO1xyXG5cdFx0XHRcdHkgPSB5IC0gd2luUGFnZVk7XHJcblx0XHRcdH0gZWxzZSBpZiAoIHkgPCAoIGV2ZW50LnBhZ2VZIC0gd2luUGFnZVkpIHx8IHggPCAoIGV2ZW50LnBhZ2VYIC0gd2luUGFnZVggKSApIHtcclxuXHJcblx0XHRcdFx0Ly8gU29tZSBBbmRyb2lkIGJyb3dzZXJzIGhhdmUgdG90YWxseSBib2d1cyB2YWx1ZXMgZm9yIGNsaWVudFgvWVxyXG5cdFx0XHRcdC8vIHdoZW4gc2Nyb2xsaW5nL3pvb21pbmcgYSBwYWdlLiBEZXRlY3RhYmxlIHNpbmNlIGNsaWVudFgvY2xpZW50WVxyXG5cdFx0XHRcdC8vIHNob3VsZCBuZXZlciBiZSBzbWFsbGVyIHRoYW4gcGFnZVgvcGFnZVkgbWludXMgcGFnZSBzY3JvbGxcclxuXHRcdFx0XHR4ID0gZXZlbnQucGFnZVggLSB3aW5QYWdlWDtcclxuXHRcdFx0XHR5ID0gZXZlbnQucGFnZVkgLSB3aW5QYWdlWTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIHtcclxuXHRcdFx0XHR4OiB4LFxyXG5cdFx0XHRcdHk6IHlcclxuXHRcdFx0fTtcclxuXHRcdH0sXHJcblxyXG5cdFx0c3RhcnQ6IGZ1bmN0aW9uKCBldmVudCApIHtcclxuXHRcdFx0dmFyIGRhdGEgPSBldmVudC5vcmlnaW5hbEV2ZW50LnRvdWNoZXMgP1xyXG5cdFx0XHRcdFx0ZXZlbnQub3JpZ2luYWxFdmVudC50b3VjaGVzWyAwIF0gOiBldmVudCxcclxuXHRcdFx0XHRsb2NhdGlvbiA9ICQuZXZlbnQuc3BlY2lhbC5zd2lwZS5nZXRMb2NhdGlvbiggZGF0YSApO1xyXG5cdFx0XHRyZXR1cm4ge1xyXG5cdFx0XHRcdFx0XHR0aW1lOiAoIG5ldyBEYXRlKCkgKS5nZXRUaW1lKCksXHJcblx0XHRcdFx0XHRcdGNvb3JkczogWyBsb2NhdGlvbi54LCBsb2NhdGlvbi55IF0sXHJcblx0XHRcdFx0XHRcdG9yaWdpbjogJCggZXZlbnQudGFyZ2V0IClcclxuXHRcdFx0XHRcdH07XHJcblx0XHR9LFxyXG5cclxuXHRcdHN0b3A6IGZ1bmN0aW9uKCBldmVudCApIHtcclxuXHRcdFx0dmFyIGRhdGEgPSBldmVudC5vcmlnaW5hbEV2ZW50LnRvdWNoZXMgP1xyXG5cdFx0XHRcdFx0ZXZlbnQub3JpZ2luYWxFdmVudC50b3VjaGVzWyAwIF0gOiBldmVudCxcclxuXHRcdFx0XHRsb2NhdGlvbiA9ICQuZXZlbnQuc3BlY2lhbC5zd2lwZS5nZXRMb2NhdGlvbiggZGF0YSApO1xyXG5cdFx0XHRyZXR1cm4ge1xyXG5cdFx0XHRcdFx0XHR0aW1lOiAoIG5ldyBEYXRlKCkgKS5nZXRUaW1lKCksXHJcblx0XHRcdFx0XHRcdGNvb3JkczogWyBsb2NhdGlvbi54LCBsb2NhdGlvbi55IF1cclxuXHRcdFx0XHRcdH07XHJcblx0XHR9LFxyXG5cclxuXHRcdGhhbmRsZVN3aXBlOiBmdW5jdGlvbiggc3RhcnQsIHN0b3AsIHRoaXNPYmplY3QsIG9yaWdUYXJnZXQgKSB7XHJcblx0XHRcdGlmICggc3RvcC50aW1lIC0gc3RhcnQudGltZSA8ICQuZXZlbnQuc3BlY2lhbC5zd2lwZS5kdXJhdGlvblRocmVzaG9sZCAmJlxyXG5cdFx0XHRcdE1hdGguYWJzKCBzdGFydC5jb29yZHNbIDAgXSAtIHN0b3AuY29vcmRzWyAwIF0gKSA+ICQuZXZlbnQuc3BlY2lhbC5zd2lwZS5ob3Jpem9udGFsRGlzdGFuY2VUaHJlc2hvbGQgJiZcclxuXHRcdFx0XHRNYXRoLmFicyggc3RhcnQuY29vcmRzWyAxIF0gLSBzdG9wLmNvb3Jkc1sgMSBdICkgPCAkLmV2ZW50LnNwZWNpYWwuc3dpcGUudmVydGljYWxEaXN0YW5jZVRocmVzaG9sZCApIHtcclxuXHRcdFx0XHR2YXIgZGlyZWN0aW9uID0gc3RhcnQuY29vcmRzWzBdID4gc3RvcC5jb29yZHNbIDAgXSA/IFwic3dpcGVsZWZ0XCIgOiBcInN3aXBlcmlnaHRcIjtcclxuXHJcblx0XHRcdFx0dHJpZ2dlckN1c3RvbUV2ZW50KCB0aGlzT2JqZWN0LCBcInN3aXBlXCIsICQuRXZlbnQoIFwic3dpcGVcIiwgeyB0YXJnZXQ6IG9yaWdUYXJnZXQsIHN3aXBlc3RhcnQ6IHN0YXJ0LCBzd2lwZXN0b3A6IHN0b3AgfSksIHRydWUgKTtcclxuXHRcdFx0XHR0cmlnZ2VyQ3VzdG9tRXZlbnQoIHRoaXNPYmplY3QsIGRpcmVjdGlvbiwkLkV2ZW50KCBkaXJlY3Rpb24sIHsgdGFyZ2V0OiBvcmlnVGFyZ2V0LCBzd2lwZXN0YXJ0OiBzdGFydCwgc3dpcGVzdG9wOiBzdG9wIH0gKSwgdHJ1ZSApO1xyXG5cdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHJcblx0XHR9LFxyXG5cclxuXHRcdC8vIFRoaXMgc2VydmVzIGFzIGEgZmxhZyB0byBlbnN1cmUgdGhhdCBhdCBtb3N0IG9uZSBzd2lwZSBldmVudCBldmVudCBpc1xyXG5cdFx0Ly8gaW4gd29yayBhdCBhbnkgZ2l2ZW4gdGltZVxyXG5cdFx0ZXZlbnRJblByb2dyZXNzOiBmYWxzZSxcclxuXHJcblx0XHRzZXR1cDogZnVuY3Rpb24oKSB7XHJcblx0XHRcdHZhciBldmVudHMsXHJcblx0XHRcdFx0dGhpc09iamVjdCA9IHRoaXMsXHJcblx0XHRcdFx0JHRoaXMgPSAkKCB0aGlzT2JqZWN0ICksXHJcblx0XHRcdFx0Y29udGV4dCA9IHt9O1xyXG5cclxuXHRcdFx0Ly8gUmV0cmlldmUgdGhlIGV2ZW50cyBkYXRhIGZvciB0aGlzIGVsZW1lbnQgYW5kIGFkZCB0aGUgc3dpcGUgY29udGV4dFxyXG5cdFx0XHRldmVudHMgPSAkLmRhdGEoIHRoaXMsIFwibW9iaWxlLWV2ZW50c1wiICk7XHJcblx0XHRcdGlmICggIWV2ZW50cyApIHtcclxuXHRcdFx0XHRldmVudHMgPSB7IGxlbmd0aDogMCB9O1xyXG5cdFx0XHRcdCQuZGF0YSggdGhpcywgXCJtb2JpbGUtZXZlbnRzXCIsIGV2ZW50cyApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGV2ZW50cy5sZW5ndGgrKztcclxuXHRcdFx0ZXZlbnRzLnN3aXBlID0gY29udGV4dDtcclxuXHJcblx0XHRcdGNvbnRleHQuc3RhcnQgPSBmdW5jdGlvbiggZXZlbnQgKSB7XHJcblxyXG5cdFx0XHRcdC8vIEJhaWwgaWYgd2UncmUgYWxyZWFkeSB3b3JraW5nIG9uIGEgc3dpcGUgZXZlbnRcclxuXHRcdFx0XHRpZiAoICQuZXZlbnQuc3BlY2lhbC5zd2lwZS5ldmVudEluUHJvZ3Jlc3MgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdCQuZXZlbnQuc3BlY2lhbC5zd2lwZS5ldmVudEluUHJvZ3Jlc3MgPSB0cnVlO1xyXG5cclxuXHRcdFx0XHR2YXIgc3RvcCxcclxuXHRcdFx0XHRcdHN0YXJ0ID0gJC5ldmVudC5zcGVjaWFsLnN3aXBlLnN0YXJ0KCBldmVudCApLFxyXG5cdFx0XHRcdFx0b3JpZ1RhcmdldCA9IGV2ZW50LnRhcmdldCxcclxuXHRcdFx0XHRcdGVtaXR0ZWQgPSBmYWxzZTtcclxuXHJcblx0XHRcdFx0Y29udGV4dC5tb3ZlID0gZnVuY3Rpb24oIGV2ZW50ICkge1xyXG5cdFx0XHRcdFx0aWYgKCAhc3RhcnQgfHwgZXZlbnQuaXNEZWZhdWx0UHJldmVudGVkKCkgKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRzdG9wID0gJC5ldmVudC5zcGVjaWFsLnN3aXBlLnN0b3AoIGV2ZW50ICk7XHJcblx0XHRcdFx0XHRpZiAoICFlbWl0dGVkICkge1xyXG5cdFx0XHRcdFx0XHRlbWl0dGVkID0gJC5ldmVudC5zcGVjaWFsLnN3aXBlLmhhbmRsZVN3aXBlKCBzdGFydCwgc3RvcCwgdGhpc09iamVjdCwgb3JpZ1RhcmdldCApO1xyXG5cdFx0XHRcdFx0XHRpZiAoIGVtaXR0ZWQgKSB7XHJcblxyXG5cdFx0XHRcdFx0XHRcdC8vIFJlc2V0IHRoZSBjb250ZXh0IHRvIG1ha2Ugd2F5IGZvciB0aGUgbmV4dCBzd2lwZSBldmVudFxyXG5cdFx0XHRcdFx0XHRcdCQuZXZlbnQuc3BlY2lhbC5zd2lwZS5ldmVudEluUHJvZ3Jlc3MgPSBmYWxzZTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0Ly8gcHJldmVudCBzY3JvbGxpbmdcclxuXHRcdFx0XHRcdGlmICggTWF0aC5hYnMoIHN0YXJ0LmNvb3Jkc1sgMCBdIC0gc3RvcC5jb29yZHNbIDAgXSApID4gJC5ldmVudC5zcGVjaWFsLnN3aXBlLnNjcm9sbFN1cHJlc3Npb25UaHJlc2hvbGQgKSB7XHJcblx0XHRcdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fTtcclxuXHJcblx0XHRcdFx0Y29udGV4dC5zdG9wID0gZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0XHRcdGVtaXR0ZWQgPSB0cnVlO1xyXG5cclxuXHRcdFx0XHRcdFx0Ly8gUmVzZXQgdGhlIGNvbnRleHQgdG8gbWFrZSB3YXkgZm9yIHRoZSBuZXh0IHN3aXBlIGV2ZW50XHJcblx0XHRcdFx0XHRcdCQuZXZlbnQuc3BlY2lhbC5zd2lwZS5ldmVudEluUHJvZ3Jlc3MgPSBmYWxzZTtcclxuXHRcdFx0XHRcdFx0JGRvY3VtZW50Lm9mZiggdG91Y2hNb3ZlRXZlbnQsIGNvbnRleHQubW92ZSApO1xyXG5cdFx0XHRcdFx0XHRjb250ZXh0Lm1vdmUgPSBudWxsO1xyXG5cdFx0XHRcdH07XHJcblxyXG5cdFx0XHRcdCRkb2N1bWVudC5vbiggdG91Y2hNb3ZlRXZlbnQsIGNvbnRleHQubW92ZSApXHJcblx0XHRcdFx0XHQub25lKCB0b3VjaFN0b3BFdmVudCwgY29udGV4dC5zdG9wICk7XHJcblx0XHRcdH07XHJcblx0XHRcdCR0aGlzLm9uKCB0b3VjaFN0YXJ0RXZlbnQsIGNvbnRleHQuc3RhcnQgKTtcclxuXHRcdH0sXHJcblxyXG5cdFx0dGVhcmRvd246IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHR2YXIgZXZlbnRzLCBjb250ZXh0O1xyXG5cclxuXHRcdFx0ZXZlbnRzID0gJC5kYXRhKCB0aGlzLCBcIm1vYmlsZS1ldmVudHNcIiApO1xyXG5cdFx0XHRpZiAoIGV2ZW50cyApIHtcclxuXHRcdFx0XHRjb250ZXh0ID0gZXZlbnRzLnN3aXBlO1xyXG5cdFx0XHRcdGRlbGV0ZSBldmVudHMuc3dpcGU7XHJcblx0XHRcdFx0ZXZlbnRzLmxlbmd0aC0tO1xyXG5cdFx0XHRcdGlmICggZXZlbnRzLmxlbmd0aCA9PT0gMCApIHtcclxuXHRcdFx0XHRcdCQucmVtb3ZlRGF0YSggdGhpcywgXCJtb2JpbGUtZXZlbnRzXCIgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggY29udGV4dCApIHtcclxuXHRcdFx0XHRpZiAoIGNvbnRleHQuc3RhcnQgKSB7XHJcblx0XHRcdFx0XHQkKCB0aGlzICkub2ZmKCB0b3VjaFN0YXJ0RXZlbnQsIGNvbnRleHQuc3RhcnQgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYgKCBjb250ZXh0Lm1vdmUgKSB7XHJcblx0XHRcdFx0XHQkZG9jdW1lbnQub2ZmKCB0b3VjaE1vdmVFdmVudCwgY29udGV4dC5tb3ZlICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmICggY29udGV4dC5zdG9wICkge1xyXG5cdFx0XHRcdFx0JGRvY3VtZW50Lm9mZiggdG91Y2hTdG9wRXZlbnQsIGNvbnRleHQuc3RvcCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH07XHJcblx0JC5lYWNoKHtcclxuXHRcdHN3aXBlbGVmdDogXCJzd2lwZS5sZWZ0XCIsXHJcblx0XHRzd2lwZXJpZ2h0OiBcInN3aXBlLnJpZ2h0XCJcclxuXHR9LCBmdW5jdGlvbiggZXZlbnQsIHNvdXJjZUV2ZW50ICkge1xyXG5cclxuXHRcdCQuZXZlbnQuc3BlY2lhbFsgZXZlbnQgXSA9IHtcclxuXHRcdFx0c2V0dXA6IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdCQoIHRoaXMgKS5iaW5kKCBzb3VyY2VFdmVudCwgJC5ub29wICk7XHJcblx0XHRcdH0sXHJcblx0XHRcdHRlYXJkb3duOiBmdW5jdGlvbigpIHtcclxuXHRcdFx0XHQkKCB0aGlzICkudW5iaW5kKCBzb3VyY2VFdmVudCApO1xyXG5cdFx0XHR9XHJcblx0XHR9O1xyXG5cdH0pO1xyXG59KSggalF1ZXJ5LCB0aGlzICk7XHJcbiovXHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbiFmdW5jdGlvbigkKSB7XHJcblxyXG5jb25zdCBNdXRhdGlvbk9ic2VydmVyID0gKGZ1bmN0aW9uICgpIHtcclxuICB2YXIgcHJlZml4ZXMgPSBbJ1dlYktpdCcsICdNb3onLCAnTycsICdNcycsICcnXTtcclxuICBmb3IgKHZhciBpPTA7IGkgPCBwcmVmaXhlcy5sZW5ndGg7IGkrKykge1xyXG4gICAgaWYgKGAke3ByZWZpeGVzW2ldfU11dGF0aW9uT2JzZXJ2ZXJgIGluIHdpbmRvdykge1xyXG4gICAgICByZXR1cm4gd2luZG93W2Ake3ByZWZpeGVzW2ldfU11dGF0aW9uT2JzZXJ2ZXJgXTtcclxuICAgIH1cclxuICB9XHJcbiAgcmV0dXJuIGZhbHNlO1xyXG59KCkpO1xyXG5cclxuY29uc3QgdHJpZ2dlcnMgPSAoZWwsIHR5cGUpID0+IHtcclxuICBlbC5kYXRhKHR5cGUpLnNwbGl0KCcgJykuZm9yRWFjaChpZCA9PiB7XHJcbiAgICAkKGAjJHtpZH1gKVsgdHlwZSA9PT0gJ2Nsb3NlJyA/ICd0cmlnZ2VyJyA6ICd0cmlnZ2VySGFuZGxlciddKGAke3R5cGV9LnpmLnRyaWdnZXJgLCBbZWxdKTtcclxuICB9KTtcclxufTtcclxuLy8gRWxlbWVudHMgd2l0aCBbZGF0YS1vcGVuXSB3aWxsIHJldmVhbCBhIHBsdWdpbiB0aGF0IHN1cHBvcnRzIGl0IHdoZW4gY2xpY2tlZC5cclxuJChkb2N1bWVudCkub24oJ2NsaWNrLnpmLnRyaWdnZXInLCAnW2RhdGEtb3Blbl0nLCBmdW5jdGlvbigpIHtcclxuICB0cmlnZ2VycygkKHRoaXMpLCAnb3BlbicpO1xyXG59KTtcclxuXHJcbi8vIEVsZW1lbnRzIHdpdGggW2RhdGEtY2xvc2VdIHdpbGwgY2xvc2UgYSBwbHVnaW4gdGhhdCBzdXBwb3J0cyBpdCB3aGVuIGNsaWNrZWQuXHJcbi8vIElmIHVzZWQgd2l0aG91dCBhIHZhbHVlIG9uIFtkYXRhLWNsb3NlXSwgdGhlIGV2ZW50IHdpbGwgYnViYmxlLCBhbGxvd2luZyBpdCB0byBjbG9zZSBhIHBhcmVudCBjb21wb25lbnQuXHJcbiQoZG9jdW1lbnQpLm9uKCdjbGljay56Zi50cmlnZ2VyJywgJ1tkYXRhLWNsb3NlXScsIGZ1bmN0aW9uKCkge1xyXG4gIGxldCBpZCA9ICQodGhpcykuZGF0YSgnY2xvc2UnKTtcclxuICBpZiAoaWQpIHtcclxuICAgIHRyaWdnZXJzKCQodGhpcyksICdjbG9zZScpO1xyXG4gIH1cclxuICBlbHNlIHtcclxuICAgICQodGhpcykudHJpZ2dlcignY2xvc2UuemYudHJpZ2dlcicpO1xyXG4gIH1cclxufSk7XHJcblxyXG4vLyBFbGVtZW50cyB3aXRoIFtkYXRhLXRvZ2dsZV0gd2lsbCB0b2dnbGUgYSBwbHVnaW4gdGhhdCBzdXBwb3J0cyBpdCB3aGVuIGNsaWNrZWQuXHJcbiQoZG9jdW1lbnQpLm9uKCdjbGljay56Zi50cmlnZ2VyJywgJ1tkYXRhLXRvZ2dsZV0nLCBmdW5jdGlvbigpIHtcclxuICBsZXQgaWQgPSAkKHRoaXMpLmRhdGEoJ3RvZ2dsZScpO1xyXG4gIGlmIChpZCkge1xyXG4gICAgdHJpZ2dlcnMoJCh0aGlzKSwgJ3RvZ2dsZScpO1xyXG4gIH0gZWxzZSB7XHJcbiAgICAkKHRoaXMpLnRyaWdnZXIoJ3RvZ2dsZS56Zi50cmlnZ2VyJyk7XHJcbiAgfVxyXG59KTtcclxuXHJcbi8vIEVsZW1lbnRzIHdpdGggW2RhdGEtY2xvc2FibGVdIHdpbGwgcmVzcG9uZCB0byBjbG9zZS56Zi50cmlnZ2VyIGV2ZW50cy5cclxuJChkb2N1bWVudCkub24oJ2Nsb3NlLnpmLnRyaWdnZXInLCAnW2RhdGEtY2xvc2FibGVdJywgZnVuY3Rpb24oZSl7XHJcbiAgZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuICBsZXQgYW5pbWF0aW9uID0gJCh0aGlzKS5kYXRhKCdjbG9zYWJsZScpO1xyXG5cclxuICBpZihhbmltYXRpb24gIT09ICcnKXtcclxuICAgIEZvdW5kYXRpb24uTW90aW9uLmFuaW1hdGVPdXQoJCh0aGlzKSwgYW5pbWF0aW9uLCBmdW5jdGlvbigpIHtcclxuICAgICAgJCh0aGlzKS50cmlnZ2VyKCdjbG9zZWQuemYnKTtcclxuICAgIH0pO1xyXG4gIH1lbHNle1xyXG4gICAgJCh0aGlzKS5mYWRlT3V0KCkudHJpZ2dlcignY2xvc2VkLnpmJyk7XHJcbiAgfVxyXG59KTtcclxuXHJcbiQoZG9jdW1lbnQpLm9uKCdmb2N1cy56Zi50cmlnZ2VyIGJsdXIuemYudHJpZ2dlcicsICdbZGF0YS10b2dnbGUtZm9jdXNdJywgZnVuY3Rpb24oKSB7XHJcbiAgbGV0IGlkID0gJCh0aGlzKS5kYXRhKCd0b2dnbGUtZm9jdXMnKTtcclxuICAkKGAjJHtpZH1gKS50cmlnZ2VySGFuZGxlcigndG9nZ2xlLnpmLnRyaWdnZXInLCBbJCh0aGlzKV0pO1xyXG59KTtcclxuXHJcbi8qKlxyXG4qIEZpcmVzIG9uY2UgYWZ0ZXIgYWxsIG90aGVyIHNjcmlwdHMgaGF2ZSBsb2FkZWRcclxuKiBAZnVuY3Rpb25cclxuKiBAcHJpdmF0ZVxyXG4qL1xyXG4kKHdpbmRvdykub24oJ2xvYWQnLCAoKSA9PiB7XHJcbiAgY2hlY2tMaXN0ZW5lcnMoKTtcclxufSk7XHJcblxyXG5mdW5jdGlvbiBjaGVja0xpc3RlbmVycygpIHtcclxuICBldmVudHNMaXN0ZW5lcigpO1xyXG4gIHJlc2l6ZUxpc3RlbmVyKCk7XHJcbiAgc2Nyb2xsTGlzdGVuZXIoKTtcclxuICBtdXRhdGVMaXN0ZW5lcigpO1xyXG4gIGNsb3NlbWVMaXN0ZW5lcigpO1xyXG59XHJcblxyXG4vLyoqKioqKioqIG9ubHkgZmlyZXMgdGhpcyBmdW5jdGlvbiBvbmNlIG9uIGxvYWQsIGlmIHRoZXJlJ3Mgc29tZXRoaW5nIHRvIHdhdGNoICoqKioqKioqXHJcbmZ1bmN0aW9uIGNsb3NlbWVMaXN0ZW5lcihwbHVnaW5OYW1lKSB7XHJcbiAgdmFyIHlldGlCb3hlcyA9ICQoJ1tkYXRhLXlldGktYm94XScpLFxyXG4gICAgICBwbHVnTmFtZXMgPSBbJ2Ryb3Bkb3duJywgJ3Rvb2x0aXAnLCAncmV2ZWFsJ107XHJcblxyXG4gIGlmKHBsdWdpbk5hbWUpe1xyXG4gICAgaWYodHlwZW9mIHBsdWdpbk5hbWUgPT09ICdzdHJpbmcnKXtcclxuICAgICAgcGx1Z05hbWVzLnB1c2gocGx1Z2luTmFtZSk7XHJcbiAgICB9ZWxzZSBpZih0eXBlb2YgcGx1Z2luTmFtZSA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIHBsdWdpbk5hbWVbMF0gPT09ICdzdHJpbmcnKXtcclxuICAgICAgcGx1Z05hbWVzLmNvbmNhdChwbHVnaW5OYW1lKTtcclxuICAgIH1lbHNle1xyXG4gICAgICBjb25zb2xlLmVycm9yKCdQbHVnaW4gbmFtZXMgbXVzdCBiZSBzdHJpbmdzJyk7XHJcbiAgICB9XHJcbiAgfVxyXG4gIGlmKHlldGlCb3hlcy5sZW5ndGgpe1xyXG4gICAgbGV0IGxpc3RlbmVycyA9IHBsdWdOYW1lcy5tYXAoKG5hbWUpID0+IHtcclxuICAgICAgcmV0dXJuIGBjbG9zZW1lLnpmLiR7bmFtZX1gO1xyXG4gICAgfSkuam9pbignICcpO1xyXG5cclxuICAgICQod2luZG93KS5vZmYobGlzdGVuZXJzKS5vbihsaXN0ZW5lcnMsIGZ1bmN0aW9uKGUsIHBsdWdpbklkKXtcclxuICAgICAgbGV0IHBsdWdpbiA9IGUubmFtZXNwYWNlLnNwbGl0KCcuJylbMF07XHJcbiAgICAgIGxldCBwbHVnaW5zID0gJChgW2RhdGEtJHtwbHVnaW59XWApLm5vdChgW2RhdGEteWV0aS1ib3g9XCIke3BsdWdpbklkfVwiXWApO1xyXG5cclxuICAgICAgcGx1Z2lucy5lYWNoKGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgbGV0IF90aGlzID0gJCh0aGlzKTtcclxuXHJcbiAgICAgICAgX3RoaXMudHJpZ2dlckhhbmRsZXIoJ2Nsb3NlLnpmLnRyaWdnZXInLCBbX3RoaXNdKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlc2l6ZUxpc3RlbmVyKGRlYm91bmNlKXtcclxuICBsZXQgdGltZXIsXHJcbiAgICAgICRub2RlcyA9ICQoJ1tkYXRhLXJlc2l6ZV0nKTtcclxuICBpZigkbm9kZXMubGVuZ3RoKXtcclxuICAgICQod2luZG93KS5vZmYoJ3Jlc2l6ZS56Zi50cmlnZ2VyJylcclxuICAgIC5vbigncmVzaXplLnpmLnRyaWdnZXInLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgIGlmICh0aW1lcikgeyBjbGVhclRpbWVvdXQodGltZXIpOyB9XHJcblxyXG4gICAgICB0aW1lciA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcclxuXHJcbiAgICAgICAgaWYoIU11dGF0aW9uT2JzZXJ2ZXIpey8vZmFsbGJhY2sgZm9yIElFIDlcclxuICAgICAgICAgICRub2Rlcy5lYWNoKGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgICQodGhpcykudHJpZ2dlckhhbmRsZXIoJ3Jlc2l6ZW1lLnpmLnRyaWdnZXInKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvL3RyaWdnZXIgYWxsIGxpc3RlbmluZyBlbGVtZW50cyBhbmQgc2lnbmFsIGEgcmVzaXplIGV2ZW50XHJcbiAgICAgICAgJG5vZGVzLmF0dHIoJ2RhdGEtZXZlbnRzJywgXCJyZXNpemVcIik7XHJcbiAgICAgIH0sIGRlYm91bmNlIHx8IDEwKTsvL2RlZmF1bHQgdGltZSB0byBlbWl0IHJlc2l6ZSBldmVudFxyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBzY3JvbGxMaXN0ZW5lcihkZWJvdW5jZSl7XHJcbiAgbGV0IHRpbWVyLFxyXG4gICAgICAkbm9kZXMgPSAkKCdbZGF0YS1zY3JvbGxdJyk7XHJcbiAgaWYoJG5vZGVzLmxlbmd0aCl7XHJcbiAgICAkKHdpbmRvdykub2ZmKCdzY3JvbGwuemYudHJpZ2dlcicpXHJcbiAgICAub24oJ3Njcm9sbC56Zi50cmlnZ2VyJywgZnVuY3Rpb24oZSl7XHJcbiAgICAgIGlmKHRpbWVyKXsgY2xlYXJUaW1lb3V0KHRpbWVyKTsgfVxyXG5cclxuICAgICAgdGltZXIgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XHJcblxyXG4gICAgICAgIGlmKCFNdXRhdGlvbk9ic2VydmVyKXsvL2ZhbGxiYWNrIGZvciBJRSA5XHJcbiAgICAgICAgICAkbm9kZXMuZWFjaChmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICAkKHRoaXMpLnRyaWdnZXJIYW5kbGVyKCdzY3JvbGxtZS56Zi50cmlnZ2VyJyk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy90cmlnZ2VyIGFsbCBsaXN0ZW5pbmcgZWxlbWVudHMgYW5kIHNpZ25hbCBhIHNjcm9sbCBldmVudFxyXG4gICAgICAgICRub2Rlcy5hdHRyKCdkYXRhLWV2ZW50cycsIFwic2Nyb2xsXCIpO1xyXG4gICAgICB9LCBkZWJvdW5jZSB8fCAxMCk7Ly9kZWZhdWx0IHRpbWUgdG8gZW1pdCBzY3JvbGwgZXZlbnRcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gbXV0YXRlTGlzdGVuZXIoZGVib3VuY2UpIHtcclxuICAgIGxldCAkbm9kZXMgPSAkKCdbZGF0YS1tdXRhdGVdJyk7XHJcbiAgICBpZiAoJG5vZGVzLmxlbmd0aCAmJiBNdXRhdGlvbk9ic2VydmVyKXtcclxuXHRcdFx0Ly90cmlnZ2VyIGFsbCBsaXN0ZW5pbmcgZWxlbWVudHMgYW5kIHNpZ25hbCBhIG11dGF0ZSBldmVudFxyXG4gICAgICAvL25vIElFIDkgb3IgMTBcclxuXHRcdFx0JG5vZGVzLmVhY2goZnVuY3Rpb24gKCkge1xyXG5cdFx0XHQgICQodGhpcykudHJpZ2dlckhhbmRsZXIoJ211dGF0ZW1lLnpmLnRyaWdnZXInKTtcclxuXHRcdFx0fSk7XHJcbiAgICB9XHJcbiB9XHJcblxyXG5mdW5jdGlvbiBldmVudHNMaXN0ZW5lcigpIHtcclxuICBpZighTXV0YXRpb25PYnNlcnZlcil7IHJldHVybiBmYWxzZTsgfVxyXG4gIGxldCBub2RlcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXJlc2l6ZV0sIFtkYXRhLXNjcm9sbF0sIFtkYXRhLW11dGF0ZV0nKTtcclxuXHJcbiAgLy9lbGVtZW50IGNhbGxiYWNrXHJcbiAgdmFyIGxpc3RlbmluZ0VsZW1lbnRzTXV0YXRpb24gPSBmdW5jdGlvbiAobXV0YXRpb25SZWNvcmRzTGlzdCkge1xyXG4gICAgICB2YXIgJHRhcmdldCA9ICQobXV0YXRpb25SZWNvcmRzTGlzdFswXS50YXJnZXQpO1xyXG5cclxuXHQgIC8vdHJpZ2dlciB0aGUgZXZlbnQgaGFuZGxlciBmb3IgdGhlIGVsZW1lbnQgZGVwZW5kaW5nIG9uIHR5cGVcclxuICAgICAgc3dpdGNoIChtdXRhdGlvblJlY29yZHNMaXN0WzBdLnR5cGUpIHtcclxuXHJcbiAgICAgICAgY2FzZSBcImF0dHJpYnV0ZXNcIjpcclxuICAgICAgICAgIGlmICgkdGFyZ2V0LmF0dHIoXCJkYXRhLWV2ZW50c1wiKSA9PT0gXCJzY3JvbGxcIiAmJiBtdXRhdGlvblJlY29yZHNMaXN0WzBdLmF0dHJpYnV0ZU5hbWUgPT09IFwiZGF0YS1ldmVudHNcIikge1xyXG5cdFx0ICBcdCR0YXJnZXQudHJpZ2dlckhhbmRsZXIoJ3Njcm9sbG1lLnpmLnRyaWdnZXInLCBbJHRhcmdldCwgd2luZG93LnBhZ2VZT2Zmc2V0XSk7XHJcblx0XHQgIH1cclxuXHRcdCAgaWYgKCR0YXJnZXQuYXR0cihcImRhdGEtZXZlbnRzXCIpID09PSBcInJlc2l6ZVwiICYmIG11dGF0aW9uUmVjb3Jkc0xpc3RbMF0uYXR0cmlidXRlTmFtZSA9PT0gXCJkYXRhLWV2ZW50c1wiKSB7XHJcblx0XHQgIFx0JHRhcmdldC50cmlnZ2VySGFuZGxlcigncmVzaXplbWUuemYudHJpZ2dlcicsIFskdGFyZ2V0XSk7XHJcblx0XHQgICB9XHJcblx0XHQgIGlmIChtdXRhdGlvblJlY29yZHNMaXN0WzBdLmF0dHJpYnV0ZU5hbWUgPT09IFwic3R5bGVcIikge1xyXG5cdFx0XHQgICR0YXJnZXQuY2xvc2VzdChcIltkYXRhLW11dGF0ZV1cIikuYXR0cihcImRhdGEtZXZlbnRzXCIsXCJtdXRhdGVcIik7XHJcblx0XHRcdCAgJHRhcmdldC5jbG9zZXN0KFwiW2RhdGEtbXV0YXRlXVwiKS50cmlnZ2VySGFuZGxlcignbXV0YXRlbWUuemYudHJpZ2dlcicsIFskdGFyZ2V0LmNsb3Nlc3QoXCJbZGF0YS1tdXRhdGVdXCIpXSk7XHJcblx0XHQgIH1cclxuXHRcdCAgYnJlYWs7XHJcblxyXG4gICAgICAgIGNhc2UgXCJjaGlsZExpc3RcIjpcclxuXHRcdCAgJHRhcmdldC5jbG9zZXN0KFwiW2RhdGEtbXV0YXRlXVwiKS5hdHRyKFwiZGF0YS1ldmVudHNcIixcIm11dGF0ZVwiKTtcclxuXHRcdCAgJHRhcmdldC5jbG9zZXN0KFwiW2RhdGEtbXV0YXRlXVwiKS50cmlnZ2VySGFuZGxlcignbXV0YXRlbWUuemYudHJpZ2dlcicsIFskdGFyZ2V0LmNsb3Nlc3QoXCJbZGF0YS1tdXRhdGVdXCIpXSk7XHJcbiAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAvL25vdGhpbmdcclxuICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBpZiAobm9kZXMubGVuZ3RoKSB7XHJcbiAgICAgIC8vZm9yIGVhY2ggZWxlbWVudCB0aGF0IG5lZWRzIHRvIGxpc3RlbiBmb3IgcmVzaXppbmcsIHNjcm9sbGluZywgb3IgbXV0YXRpb24gYWRkIGEgc2luZ2xlIG9ic2VydmVyXHJcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDw9IG5vZGVzLmxlbmd0aCAtIDE7IGkrKykge1xyXG4gICAgICAgIHZhciBlbGVtZW50T2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcihsaXN0ZW5pbmdFbGVtZW50c011dGF0aW9uKTtcclxuICAgICAgICBlbGVtZW50T2JzZXJ2ZXIub2JzZXJ2ZShub2Rlc1tpXSwgeyBhdHRyaWJ1dGVzOiB0cnVlLCBjaGlsZExpc3Q6IHRydWUsIGNoYXJhY3RlckRhdGE6IGZhbHNlLCBzdWJ0cmVlOiB0cnVlLCBhdHRyaWJ1dGVGaWx0ZXI6IFtcImRhdGEtZXZlbnRzXCIsIFwic3R5bGVcIl0gfSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8vIFtQSF1cclxuLy8gRm91bmRhdGlvbi5DaGVja1dhdGNoZXJzID0gY2hlY2tXYXRjaGVycztcclxuRm91bmRhdGlvbi5JSGVhcllvdSA9IGNoZWNrTGlzdGVuZXJzO1xyXG4vLyBGb3VuZGF0aW9uLklTZWVZb3UgPSBzY3JvbGxMaXN0ZW5lcjtcclxuLy8gRm91bmRhdGlvbi5JRmVlbFlvdSA9IGNsb3NlbWVMaXN0ZW5lcjtcclxuXHJcbn0oalF1ZXJ5KTtcclxuXHJcbi8vIGZ1bmN0aW9uIGRvbU11dGF0aW9uT2JzZXJ2ZXIoZGVib3VuY2UpIHtcclxuLy8gICAvLyAhISEgVGhpcyBpcyBjb21pbmcgc29vbiBhbmQgbmVlZHMgbW9yZSB3b3JrOyBub3QgYWN0aXZlICAhISEgLy9cclxuLy8gICB2YXIgdGltZXIsXHJcbi8vICAgbm9kZXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1tdXRhdGVdJyk7XHJcbi8vICAgLy9cclxuLy8gICBpZiAobm9kZXMubGVuZ3RoKSB7XHJcbi8vICAgICAvLyB2YXIgTXV0YXRpb25PYnNlcnZlciA9IChmdW5jdGlvbiAoKSB7XHJcbi8vICAgICAvLyAgIHZhciBwcmVmaXhlcyA9IFsnV2ViS2l0JywgJ01veicsICdPJywgJ01zJywgJyddO1xyXG4vLyAgICAgLy8gICBmb3IgKHZhciBpPTA7IGkgPCBwcmVmaXhlcy5sZW5ndGg7IGkrKykge1xyXG4vLyAgICAgLy8gICAgIGlmIChwcmVmaXhlc1tpXSArICdNdXRhdGlvbk9ic2VydmVyJyBpbiB3aW5kb3cpIHtcclxuLy8gICAgIC8vICAgICAgIHJldHVybiB3aW5kb3dbcHJlZml4ZXNbaV0gKyAnTXV0YXRpb25PYnNlcnZlciddO1xyXG4vLyAgICAgLy8gICAgIH1cclxuLy8gICAgIC8vICAgfVxyXG4vLyAgICAgLy8gICByZXR1cm4gZmFsc2U7XHJcbi8vICAgICAvLyB9KCkpO1xyXG4vL1xyXG4vL1xyXG4vLyAgICAgLy9mb3IgdGhlIGJvZHksIHdlIG5lZWQgdG8gbGlzdGVuIGZvciBhbGwgY2hhbmdlcyBlZmZlY3RpbmcgdGhlIHN0eWxlIGFuZCBjbGFzcyBhdHRyaWJ1dGVzXHJcbi8vICAgICB2YXIgYm9keU9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoYm9keU11dGF0aW9uKTtcclxuLy8gICAgIGJvZHlPYnNlcnZlci5vYnNlcnZlKGRvY3VtZW50LmJvZHksIHsgYXR0cmlidXRlczogdHJ1ZSwgY2hpbGRMaXN0OiB0cnVlLCBjaGFyYWN0ZXJEYXRhOiBmYWxzZSwgc3VidHJlZTp0cnVlLCBhdHRyaWJ1dGVGaWx0ZXI6W1wic3R5bGVcIiwgXCJjbGFzc1wiXX0pO1xyXG4vL1xyXG4vL1xyXG4vLyAgICAgLy9ib2R5IGNhbGxiYWNrXHJcbi8vICAgICBmdW5jdGlvbiBib2R5TXV0YXRpb24obXV0YXRlKSB7XHJcbi8vICAgICAgIC8vdHJpZ2dlciBhbGwgbGlzdGVuaW5nIGVsZW1lbnRzIGFuZCBzaWduYWwgYSBtdXRhdGlvbiBldmVudFxyXG4vLyAgICAgICBpZiAodGltZXIpIHsgY2xlYXJUaW1lb3V0KHRpbWVyKTsgfVxyXG4vL1xyXG4vLyAgICAgICB0aW1lciA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcbi8vICAgICAgICAgYm9keU9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcclxuLy8gICAgICAgICAkKCdbZGF0YS1tdXRhdGVdJykuYXR0cignZGF0YS1ldmVudHMnLFwibXV0YXRlXCIpO1xyXG4vLyAgICAgICB9LCBkZWJvdW5jZSB8fCAxNTApO1xyXG4vLyAgICAgfVxyXG4vLyAgIH1cclxuLy8gfVxyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG4hZnVuY3Rpb24oJCkge1xyXG5cclxuLyoqXHJcbiAqIEFiaWRlIG1vZHVsZS5cclxuICogQG1vZHVsZSBmb3VuZGF0aW9uLmFiaWRlXHJcbiAqL1xyXG5cclxuY2xhc3MgQWJpZGUge1xyXG4gIC8qKlxyXG4gICAqIENyZWF0ZXMgYSBuZXcgaW5zdGFuY2Ugb2YgQWJpZGUuXHJcbiAgICogQGNsYXNzXHJcbiAgICogQGZpcmVzIEFiaWRlI2luaXRcclxuICAgKiBAcGFyYW0ge09iamVjdH0gZWxlbWVudCAtIGpRdWVyeSBvYmplY3QgdG8gYWRkIHRoZSB0cmlnZ2VyIHRvLlxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIC0gT3ZlcnJpZGVzIHRvIHRoZSBkZWZhdWx0IHBsdWdpbiBzZXR0aW5ncy5cclxuICAgKi9cclxuICBjb25zdHJ1Y3RvcihlbGVtZW50LCBvcHRpb25zID0ge30pIHtcclxuICAgIHRoaXMuJGVsZW1lbnQgPSBlbGVtZW50O1xyXG4gICAgdGhpcy5vcHRpb25zICA9ICQuZXh0ZW5kKHt9LCBBYmlkZS5kZWZhdWx0cywgdGhpcy4kZWxlbWVudC5kYXRhKCksIG9wdGlvbnMpO1xyXG5cclxuICAgIHRoaXMuX2luaXQoKTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLnJlZ2lzdGVyUGx1Z2luKHRoaXMsICdBYmlkZScpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbGl6ZXMgdGhlIEFiaWRlIHBsdWdpbiBhbmQgY2FsbHMgZnVuY3Rpb25zIHRvIGdldCBBYmlkZSBmdW5jdGlvbmluZyBvbiBsb2FkLlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2luaXQoKSB7XHJcbiAgICB0aGlzLiRpbnB1dHMgPSB0aGlzLiRlbGVtZW50LmZpbmQoJ2lucHV0LCB0ZXh0YXJlYSwgc2VsZWN0Jyk7XHJcblxyXG4gICAgdGhpcy5fZXZlbnRzKCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJbml0aWFsaXplcyBldmVudHMgZm9yIEFiaWRlLlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2V2ZW50cygpIHtcclxuICAgIHRoaXMuJGVsZW1lbnQub2ZmKCcuYWJpZGUnKVxyXG4gICAgICAub24oJ3Jlc2V0LnpmLmFiaWRlJywgKCkgPT4ge1xyXG4gICAgICAgIHRoaXMucmVzZXRGb3JtKCk7XHJcbiAgICAgIH0pXHJcbiAgICAgIC5vbignc3VibWl0LnpmLmFiaWRlJywgKCkgPT4ge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnZhbGlkYXRlRm9ybSgpO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLnZhbGlkYXRlT24gPT09ICdmaWVsZENoYW5nZScpIHtcclxuICAgICAgdGhpcy4kaW5wdXRzXHJcbiAgICAgICAgLm9mZignY2hhbmdlLnpmLmFiaWRlJylcclxuICAgICAgICAub24oJ2NoYW5nZS56Zi5hYmlkZScsIChlKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLnZhbGlkYXRlSW5wdXQoJChlLnRhcmdldCkpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMubGl2ZVZhbGlkYXRlKSB7XHJcbiAgICAgIHRoaXMuJGlucHV0c1xyXG4gICAgICAgIC5vZmYoJ2lucHV0LnpmLmFiaWRlJylcclxuICAgICAgICAub24oJ2lucHV0LnpmLmFiaWRlJywgKGUpID0+IHtcclxuICAgICAgICAgIHRoaXMudmFsaWRhdGVJbnB1dCgkKGUudGFyZ2V0KSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy52YWxpZGF0ZU9uQmx1cikge1xyXG4gICAgICB0aGlzLiRpbnB1dHNcclxuICAgICAgICAub2ZmKCdibHVyLnpmLmFiaWRlJylcclxuICAgICAgICAub24oJ2JsdXIuemYuYWJpZGUnLCAoZSkgPT4ge1xyXG4gICAgICAgICAgdGhpcy52YWxpZGF0ZUlucHV0KCQoZS50YXJnZXQpKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENhbGxzIG5lY2Vzc2FyeSBmdW5jdGlvbnMgdG8gdXBkYXRlIEFiaWRlIHVwb24gRE9NIGNoYW5nZVxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX3JlZmxvdygpIHtcclxuICAgIHRoaXMuX2luaXQoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrcyB3aGV0aGVyIG9yIG5vdCBhIGZvcm0gZWxlbWVudCBoYXMgdGhlIHJlcXVpcmVkIGF0dHJpYnV0ZSBhbmQgaWYgaXQncyBjaGVja2VkIG9yIG5vdFxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBlbGVtZW50IC0galF1ZXJ5IG9iamVjdCB0byBjaGVjayBmb3IgcmVxdWlyZWQgYXR0cmlidXRlXHJcbiAgICogQHJldHVybnMge0Jvb2xlYW59IEJvb2xlYW4gdmFsdWUgZGVwZW5kcyBvbiB3aGV0aGVyIG9yIG5vdCBhdHRyaWJ1dGUgaXMgY2hlY2tlZCBvciBlbXB0eVxyXG4gICAqL1xyXG4gIHJlcXVpcmVkQ2hlY2soJGVsKSB7XHJcbiAgICBpZiAoISRlbC5hdHRyKCdyZXF1aXJlZCcpKSByZXR1cm4gdHJ1ZTtcclxuXHJcbiAgICB2YXIgaXNHb29kID0gdHJ1ZTtcclxuXHJcbiAgICBzd2l0Y2ggKCRlbFswXS50eXBlKSB7XHJcbiAgICAgIGNhc2UgJ2NoZWNrYm94JzpcclxuICAgICAgICBpc0dvb2QgPSAkZWxbMF0uY2hlY2tlZDtcclxuICAgICAgICBicmVhaztcclxuXHJcbiAgICAgIGNhc2UgJ3NlbGVjdCc6XHJcbiAgICAgIGNhc2UgJ3NlbGVjdC1vbmUnOlxyXG4gICAgICBjYXNlICdzZWxlY3QtbXVsdGlwbGUnOlxyXG4gICAgICAgIHZhciBvcHQgPSAkZWwuZmluZCgnb3B0aW9uOnNlbGVjdGVkJyk7XHJcbiAgICAgICAgaWYgKCFvcHQubGVuZ3RoIHx8ICFvcHQudmFsKCkpIGlzR29vZCA9IGZhbHNlO1xyXG4gICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgZGVmYXVsdDpcclxuICAgICAgICBpZighJGVsLnZhbCgpIHx8ICEkZWwudmFsKCkubGVuZ3RoKSBpc0dvb2QgPSBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gaXNHb29kO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQmFzZWQgb24gJGVsLCBnZXQgdGhlIGZpcnN0IGVsZW1lbnQgd2l0aCBzZWxlY3RvciBpbiB0aGlzIG9yZGVyOlxyXG4gICAqIDEuIFRoZSBlbGVtZW50J3MgZGlyZWN0IHNpYmxpbmcoJ3MpLlxyXG4gICAqIDMuIFRoZSBlbGVtZW50J3MgcGFyZW50J3MgY2hpbGRyZW4uXHJcbiAgICpcclxuICAgKiBUaGlzIGFsbG93cyBmb3IgbXVsdGlwbGUgZm9ybSBlcnJvcnMgcGVyIGlucHV0LCB0aG91Z2ggaWYgbm9uZSBhcmUgZm91bmQsIG5vIGZvcm0gZXJyb3JzIHdpbGwgYmUgc2hvd24uXHJcbiAgICpcclxuICAgKiBAcGFyYW0ge09iamVjdH0gJGVsIC0galF1ZXJ5IG9iamVjdCB0byB1c2UgYXMgcmVmZXJlbmNlIHRvIGZpbmQgdGhlIGZvcm0gZXJyb3Igc2VsZWN0b3IuXHJcbiAgICogQHJldHVybnMge09iamVjdH0galF1ZXJ5IG9iamVjdCB3aXRoIHRoZSBzZWxlY3Rvci5cclxuICAgKi9cclxuICBmaW5kRm9ybUVycm9yKCRlbCkge1xyXG4gICAgdmFyICRlcnJvciA9ICRlbC5zaWJsaW5ncyh0aGlzLm9wdGlvbnMuZm9ybUVycm9yU2VsZWN0b3IpO1xyXG5cclxuICAgIGlmICghJGVycm9yLmxlbmd0aCkge1xyXG4gICAgICAkZXJyb3IgPSAkZWwucGFyZW50KCkuZmluZCh0aGlzLm9wdGlvbnMuZm9ybUVycm9yU2VsZWN0b3IpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiAkZXJyb3I7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIGZpcnN0IGVsZW1lbnQgaW4gdGhpcyBvcmRlcjpcclxuICAgKiAyLiBUaGUgPGxhYmVsPiB3aXRoIHRoZSBhdHRyaWJ1dGUgYFtmb3I9XCJzb21lSW5wdXRJZFwiXWBcclxuICAgKiAzLiBUaGUgYC5jbG9zZXN0KClgIDxsYWJlbD5cclxuICAgKlxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSAkZWwgLSBqUXVlcnkgb2JqZWN0IHRvIGNoZWNrIGZvciByZXF1aXJlZCBhdHRyaWJ1dGVcclxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gQm9vbGVhbiB2YWx1ZSBkZXBlbmRzIG9uIHdoZXRoZXIgb3Igbm90IGF0dHJpYnV0ZSBpcyBjaGVja2VkIG9yIGVtcHR5XHJcbiAgICovXHJcbiAgZmluZExhYmVsKCRlbCkge1xyXG4gICAgdmFyIGlkID0gJGVsWzBdLmlkO1xyXG4gICAgdmFyICRsYWJlbCA9IHRoaXMuJGVsZW1lbnQuZmluZChgbGFiZWxbZm9yPVwiJHtpZH1cIl1gKTtcclxuXHJcbiAgICBpZiAoISRsYWJlbC5sZW5ndGgpIHtcclxuICAgICAgcmV0dXJuICRlbC5jbG9zZXN0KCdsYWJlbCcpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiAkbGFiZWw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIHNldCBvZiBsYWJlbHMgYXNzb2NpYXRlZCB3aXRoIGEgc2V0IG9mIHJhZGlvIGVscyBpbiB0aGlzIG9yZGVyXHJcbiAgICogMi4gVGhlIDxsYWJlbD4gd2l0aCB0aGUgYXR0cmlidXRlIGBbZm9yPVwic29tZUlucHV0SWRcIl1gXHJcbiAgICogMy4gVGhlIGAuY2xvc2VzdCgpYCA8bGFiZWw+XHJcbiAgICpcclxuICAgKiBAcGFyYW0ge09iamVjdH0gJGVsIC0galF1ZXJ5IG9iamVjdCB0byBjaGVjayBmb3IgcmVxdWlyZWQgYXR0cmlidXRlXHJcbiAgICogQHJldHVybnMge0Jvb2xlYW59IEJvb2xlYW4gdmFsdWUgZGVwZW5kcyBvbiB3aGV0aGVyIG9yIG5vdCBhdHRyaWJ1dGUgaXMgY2hlY2tlZCBvciBlbXB0eVxyXG4gICAqL1xyXG4gIGZpbmRSYWRpb0xhYmVscygkZWxzKSB7XHJcbiAgICB2YXIgbGFiZWxzID0gJGVscy5tYXAoKGksIGVsKSA9PiB7XHJcbiAgICAgIHZhciBpZCA9IGVsLmlkO1xyXG4gICAgICB2YXIgJGxhYmVsID0gdGhpcy4kZWxlbWVudC5maW5kKGBsYWJlbFtmb3I9XCIke2lkfVwiXWApO1xyXG5cclxuICAgICAgaWYgKCEkbGFiZWwubGVuZ3RoKSB7XHJcbiAgICAgICAgJGxhYmVsID0gJChlbCkuY2xvc2VzdCgnbGFiZWwnKTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gJGxhYmVsWzBdO1xyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuICQobGFiZWxzKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMgdGhlIENTUyBlcnJvciBjbGFzcyBhcyBzcGVjaWZpZWQgYnkgdGhlIEFiaWRlIHNldHRpbmdzIHRvIHRoZSBsYWJlbCwgaW5wdXQsIGFuZCB0aGUgZm9ybVxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSAkZWwgLSBqUXVlcnkgb2JqZWN0IHRvIGFkZCB0aGUgY2xhc3MgdG9cclxuICAgKi9cclxuICBhZGRFcnJvckNsYXNzZXMoJGVsKSB7XHJcbiAgICB2YXIgJGxhYmVsID0gdGhpcy5maW5kTGFiZWwoJGVsKTtcclxuICAgIHZhciAkZm9ybUVycm9yID0gdGhpcy5maW5kRm9ybUVycm9yKCRlbCk7XHJcblxyXG4gICAgaWYgKCRsYWJlbC5sZW5ndGgpIHtcclxuICAgICAgJGxhYmVsLmFkZENsYXNzKHRoaXMub3B0aW9ucy5sYWJlbEVycm9yQ2xhc3MpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICgkZm9ybUVycm9yLmxlbmd0aCkge1xyXG4gICAgICAkZm9ybUVycm9yLmFkZENsYXNzKHRoaXMub3B0aW9ucy5mb3JtRXJyb3JDbGFzcyk7XHJcbiAgICB9XHJcblxyXG4gICAgJGVsLmFkZENsYXNzKHRoaXMub3B0aW9ucy5pbnB1dEVycm9yQ2xhc3MpLmF0dHIoJ2RhdGEtaW52YWxpZCcsICcnKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlbW92ZSBDU1MgZXJyb3IgY2xhc3NlcyBldGMgZnJvbSBhbiBlbnRpcmUgcmFkaW8gYnV0dG9uIGdyb3VwXHJcbiAgICogQHBhcmFtIHtTdHJpbmd9IGdyb3VwTmFtZSAtIEEgc3RyaW5nIHRoYXQgc3BlY2lmaWVzIHRoZSBuYW1lIG9mIGEgcmFkaW8gYnV0dG9uIGdyb3VwXHJcbiAgICpcclxuICAgKi9cclxuXHJcbiAgcmVtb3ZlUmFkaW9FcnJvckNsYXNzZXMoZ3JvdXBOYW1lKSB7XHJcbiAgICB2YXIgJGVscyA9IHRoaXMuJGVsZW1lbnQuZmluZChgOnJhZGlvW25hbWU9XCIke2dyb3VwTmFtZX1cIl1gKTtcclxuICAgIHZhciAkbGFiZWxzID0gdGhpcy5maW5kUmFkaW9MYWJlbHMoJGVscyk7XHJcbiAgICB2YXIgJGZvcm1FcnJvcnMgPSB0aGlzLmZpbmRGb3JtRXJyb3IoJGVscyk7XHJcblxyXG4gICAgaWYgKCRsYWJlbHMubGVuZ3RoKSB7XHJcbiAgICAgICRsYWJlbHMucmVtb3ZlQ2xhc3ModGhpcy5vcHRpb25zLmxhYmVsRXJyb3JDbGFzcyk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCRmb3JtRXJyb3JzLmxlbmd0aCkge1xyXG4gICAgICAkZm9ybUVycm9ycy5yZW1vdmVDbGFzcyh0aGlzLm9wdGlvbnMuZm9ybUVycm9yQ2xhc3MpO1xyXG4gICAgfVxyXG5cclxuICAgICRlbHMucmVtb3ZlQ2xhc3ModGhpcy5vcHRpb25zLmlucHV0RXJyb3JDbGFzcykucmVtb3ZlQXR0cignZGF0YS1pbnZhbGlkJyk7XHJcblxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVtb3ZlcyBDU1MgZXJyb3IgY2xhc3MgYXMgc3BlY2lmaWVkIGJ5IHRoZSBBYmlkZSBzZXR0aW5ncyBmcm9tIHRoZSBsYWJlbCwgaW5wdXQsIGFuZCB0aGUgZm9ybVxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSAkZWwgLSBqUXVlcnkgb2JqZWN0IHRvIHJlbW92ZSB0aGUgY2xhc3MgZnJvbVxyXG4gICAqL1xyXG4gIHJlbW92ZUVycm9yQ2xhc3NlcygkZWwpIHtcclxuICAgIC8vIHJhZGlvcyBuZWVkIHRvIGNsZWFyIGFsbCBvZiB0aGUgZWxzXHJcbiAgICBpZigkZWxbMF0udHlwZSA9PSAncmFkaW8nKSB7XHJcbiAgICAgIHJldHVybiB0aGlzLnJlbW92ZVJhZGlvRXJyb3JDbGFzc2VzKCRlbC5hdHRyKCduYW1lJykpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciAkbGFiZWwgPSB0aGlzLmZpbmRMYWJlbCgkZWwpO1xyXG4gICAgdmFyICRmb3JtRXJyb3IgPSB0aGlzLmZpbmRGb3JtRXJyb3IoJGVsKTtcclxuXHJcbiAgICBpZiAoJGxhYmVsLmxlbmd0aCkge1xyXG4gICAgICAkbGFiZWwucmVtb3ZlQ2xhc3ModGhpcy5vcHRpb25zLmxhYmVsRXJyb3JDbGFzcyk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCRmb3JtRXJyb3IubGVuZ3RoKSB7XHJcbiAgICAgICRmb3JtRXJyb3IucmVtb3ZlQ2xhc3ModGhpcy5vcHRpb25zLmZvcm1FcnJvckNsYXNzKTtcclxuICAgIH1cclxuXHJcbiAgICAkZWwucmVtb3ZlQ2xhc3ModGhpcy5vcHRpb25zLmlucHV0RXJyb3JDbGFzcykucmVtb3ZlQXR0cignZGF0YS1pbnZhbGlkJyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHb2VzIHRocm91Z2ggYSBmb3JtIHRvIGZpbmQgaW5wdXRzIGFuZCBwcm9jZWVkcyB0byB2YWxpZGF0ZSB0aGVtIGluIHdheXMgc3BlY2lmaWMgdG8gdGhlaXIgdHlwZVxyXG4gICAqIEBmaXJlcyBBYmlkZSNpbnZhbGlkXHJcbiAgICogQGZpcmVzIEFiaWRlI3ZhbGlkXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IGVsZW1lbnQgLSBqUXVlcnkgb2JqZWN0IHRvIHZhbGlkYXRlLCBzaG91bGQgYmUgYW4gSFRNTCBpbnB1dFxyXG4gICAqIEByZXR1cm5zIHtCb29sZWFufSBnb29kVG9HbyAtIElmIHRoZSBpbnB1dCBpcyB2YWxpZCBvciBub3QuXHJcbiAgICovXHJcbiAgdmFsaWRhdGVJbnB1dCgkZWwpIHtcclxuICAgIHZhciBjbGVhclJlcXVpcmUgPSB0aGlzLnJlcXVpcmVkQ2hlY2soJGVsKSxcclxuICAgICAgICB2YWxpZGF0ZWQgPSBmYWxzZSxcclxuICAgICAgICBjdXN0b21WYWxpZGF0b3IgPSB0cnVlLFxyXG4gICAgICAgIHZhbGlkYXRvciA9ICRlbC5hdHRyKCdkYXRhLXZhbGlkYXRvcicpLFxyXG4gICAgICAgIGVxdWFsVG8gPSB0cnVlO1xyXG5cclxuICAgIC8vIGRvbid0IHZhbGlkYXRlIGlnbm9yZWQgaW5wdXRzIG9yIGhpZGRlbiBpbnB1dHNcclxuICAgIGlmICgkZWwuaXMoJ1tkYXRhLWFiaWRlLWlnbm9yZV0nKSB8fCAkZWwuaXMoJ1t0eXBlPVwiaGlkZGVuXCJdJykpIHtcclxuICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcblxyXG4gICAgc3dpdGNoICgkZWxbMF0udHlwZSkge1xyXG4gICAgICBjYXNlICdyYWRpbyc6XHJcbiAgICAgICAgdmFsaWRhdGVkID0gdGhpcy52YWxpZGF0ZVJhZGlvKCRlbC5hdHRyKCduYW1lJykpO1xyXG4gICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgY2FzZSAnY2hlY2tib3gnOlxyXG4gICAgICAgIHZhbGlkYXRlZCA9IGNsZWFyUmVxdWlyZTtcclxuICAgICAgICBicmVhaztcclxuXHJcbiAgICAgIGNhc2UgJ3NlbGVjdCc6XHJcbiAgICAgIGNhc2UgJ3NlbGVjdC1vbmUnOlxyXG4gICAgICBjYXNlICdzZWxlY3QtbXVsdGlwbGUnOlxyXG4gICAgICAgIHZhbGlkYXRlZCA9IGNsZWFyUmVxdWlyZTtcclxuICAgICAgICBicmVhaztcclxuXHJcbiAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgdmFsaWRhdGVkID0gdGhpcy52YWxpZGF0ZVRleHQoJGVsKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodmFsaWRhdG9yKSB7XHJcbiAgICAgIGN1c3RvbVZhbGlkYXRvciA9IHRoaXMubWF0Y2hWYWxpZGF0aW9uKCRlbCwgdmFsaWRhdG9yLCAkZWwuYXR0cigncmVxdWlyZWQnKSk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCRlbC5hdHRyKCdkYXRhLWVxdWFsdG8nKSkge1xyXG4gICAgICBlcXVhbFRvID0gdGhpcy5vcHRpb25zLnZhbGlkYXRvcnMuZXF1YWxUbygkZWwpO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICB2YXIgZ29vZFRvR28gPSBbY2xlYXJSZXF1aXJlLCB2YWxpZGF0ZWQsIGN1c3RvbVZhbGlkYXRvciwgZXF1YWxUb10uaW5kZXhPZihmYWxzZSkgPT09IC0xO1xyXG4gICAgdmFyIG1lc3NhZ2UgPSAoZ29vZFRvR28gPyAndmFsaWQnIDogJ2ludmFsaWQnKSArICcuemYuYWJpZGUnO1xyXG5cclxuICAgIGlmIChnb29kVG9Hbykge1xyXG4gICAgICAvLyBSZS12YWxpZGF0ZSBpbnB1dHMgdGhhdCBkZXBlbmQgb24gdGhpcyBvbmUgd2l0aCBlcXVhbHRvXHJcbiAgICAgIGNvbnN0IGRlcGVuZGVudEVsZW1lbnRzID0gdGhpcy4kZWxlbWVudC5maW5kKGBbZGF0YS1lcXVhbHRvPVwiJHskZWwuYXR0cignaWQnKX1cIl1gKTtcclxuICAgICAgaWYgKGRlcGVuZGVudEVsZW1lbnRzLmxlbmd0aCkge1xyXG4gICAgICAgIGxldCBfdGhpcyA9IHRoaXM7XHJcbiAgICAgICAgZGVwZW5kZW50RWxlbWVudHMuZWFjaChmdW5jdGlvbigpIHtcclxuICAgICAgICAgIGlmICgkKHRoaXMpLnZhbCgpKSB7XHJcbiAgICAgICAgICAgIF90aGlzLnZhbGlkYXRlSW5wdXQoJCh0aGlzKSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICB0aGlzW2dvb2RUb0dvID8gJ3JlbW92ZUVycm9yQ2xhc3NlcycgOiAnYWRkRXJyb3JDbGFzc2VzJ10oJGVsKTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIEZpcmVzIHdoZW4gdGhlIGlucHV0IGlzIGRvbmUgY2hlY2tpbmcgZm9yIHZhbGlkYXRpb24uIEV2ZW50IHRyaWdnZXIgaXMgZWl0aGVyIGB2YWxpZC56Zi5hYmlkZWAgb3IgYGludmFsaWQuemYuYWJpZGVgXHJcbiAgICAgKiBUcmlnZ2VyIGluY2x1ZGVzIHRoZSBET00gZWxlbWVudCBvZiB0aGUgaW5wdXQuXHJcbiAgICAgKiBAZXZlbnQgQWJpZGUjdmFsaWRcclxuICAgICAqIEBldmVudCBBYmlkZSNpbnZhbGlkXHJcbiAgICAgKi9cclxuICAgICRlbC50cmlnZ2VyKG1lc3NhZ2UsIFskZWxdKTtcclxuXHJcbiAgICByZXR1cm4gZ29vZFRvR287XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHb2VzIHRocm91Z2ggYSBmb3JtIGFuZCBpZiB0aGVyZSBhcmUgYW55IGludmFsaWQgaW5wdXRzLCBpdCB3aWxsIGRpc3BsYXkgdGhlIGZvcm0gZXJyb3IgZWxlbWVudFxyXG4gICAqIEByZXR1cm5zIHtCb29sZWFufSBub0Vycm9yIC0gdHJ1ZSBpZiBubyBlcnJvcnMgd2VyZSBkZXRlY3RlZC4uLlxyXG4gICAqIEBmaXJlcyBBYmlkZSNmb3JtdmFsaWRcclxuICAgKiBAZmlyZXMgQWJpZGUjZm9ybWludmFsaWRcclxuICAgKi9cclxuICB2YWxpZGF0ZUZvcm0oKSB7XHJcbiAgICB2YXIgYWNjID0gW107XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG5cclxuICAgIHRoaXMuJGlucHV0cy5lYWNoKGZ1bmN0aW9uKCkge1xyXG4gICAgICBhY2MucHVzaChfdGhpcy52YWxpZGF0ZUlucHV0KCQodGhpcykpKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHZhciBub0Vycm9yID0gYWNjLmluZGV4T2YoZmFsc2UpID09PSAtMTtcclxuXHJcbiAgICB0aGlzLiRlbGVtZW50LmZpbmQoJ1tkYXRhLWFiaWRlLWVycm9yXScpLmNzcygnZGlzcGxheScsIChub0Vycm9yID8gJ25vbmUnIDogJ2Jsb2NrJykpO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogRmlyZXMgd2hlbiB0aGUgZm9ybSBpcyBmaW5pc2hlZCB2YWxpZGF0aW5nLiBFdmVudCB0cmlnZ2VyIGlzIGVpdGhlciBgZm9ybXZhbGlkLnpmLmFiaWRlYCBvciBgZm9ybWludmFsaWQuemYuYWJpZGVgLlxyXG4gICAgICogVHJpZ2dlciBpbmNsdWRlcyB0aGUgZWxlbWVudCBvZiB0aGUgZm9ybS5cclxuICAgICAqIEBldmVudCBBYmlkZSNmb3JtdmFsaWRcclxuICAgICAqIEBldmVudCBBYmlkZSNmb3JtaW52YWxpZFxyXG4gICAgICovXHJcbiAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoKG5vRXJyb3IgPyAnZm9ybXZhbGlkJyA6ICdmb3JtaW52YWxpZCcpICsgJy56Zi5hYmlkZScsIFt0aGlzLiRlbGVtZW50XSk7XHJcblxyXG4gICAgcmV0dXJuIG5vRXJyb3I7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZXRlcm1pbmVzIHdoZXRoZXIgb3IgYSBub3QgYSB0ZXh0IGlucHV0IGlzIHZhbGlkIGJhc2VkIG9uIHRoZSBwYXR0ZXJuIHNwZWNpZmllZCBpbiB0aGUgYXR0cmlidXRlLiBJZiBubyBtYXRjaGluZyBwYXR0ZXJuIGlzIGZvdW5kLCByZXR1cm5zIHRydWUuXHJcbiAgICogQHBhcmFtIHtPYmplY3R9ICRlbCAtIGpRdWVyeSBvYmplY3QgdG8gdmFsaWRhdGUsIHNob3VsZCBiZSBhIHRleHQgaW5wdXQgSFRNTCBlbGVtZW50XHJcbiAgICogQHBhcmFtIHtTdHJpbmd9IHBhdHRlcm4gLSBzdHJpbmcgdmFsdWUgb2Ygb25lIG9mIHRoZSBSZWdFeCBwYXR0ZXJucyBpbiBBYmlkZS5vcHRpb25zLnBhdHRlcm5zXHJcbiAgICogQHJldHVybnMge0Jvb2xlYW59IEJvb2xlYW4gdmFsdWUgZGVwZW5kcyBvbiB3aGV0aGVyIG9yIG5vdCB0aGUgaW5wdXQgdmFsdWUgbWF0Y2hlcyB0aGUgcGF0dGVybiBzcGVjaWZpZWRcclxuICAgKi9cclxuICB2YWxpZGF0ZVRleHQoJGVsLCBwYXR0ZXJuKSB7XHJcbiAgICAvLyBBIHBhdHRlcm4gY2FuIGJlIHBhc3NlZCB0byB0aGlzIGZ1bmN0aW9uLCBvciBpdCB3aWxsIGJlIGluZmVyZWQgZnJvbSB0aGUgaW5wdXQncyBcInBhdHRlcm5cIiBhdHRyaWJ1dGUsIG9yIGl0J3MgXCJ0eXBlXCIgYXR0cmlidXRlXHJcbiAgICBwYXR0ZXJuID0gKHBhdHRlcm4gfHwgJGVsLmF0dHIoJ3BhdHRlcm4nKSB8fCAkZWwuYXR0cigndHlwZScpKTtcclxuICAgIHZhciBpbnB1dFRleHQgPSAkZWwudmFsKCk7XHJcbiAgICB2YXIgdmFsaWQgPSBmYWxzZTtcclxuXHJcbiAgICBpZiAoaW5wdXRUZXh0Lmxlbmd0aCkge1xyXG4gICAgICAvLyBJZiB0aGUgcGF0dGVybiBhdHRyaWJ1dGUgb24gdGhlIGVsZW1lbnQgaXMgaW4gQWJpZGUncyBsaXN0IG9mIHBhdHRlcm5zLCB0aGVuIHRlc3QgdGhhdCByZWdleHBcclxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5wYXR0ZXJucy5oYXNPd25Qcm9wZXJ0eShwYXR0ZXJuKSkge1xyXG4gICAgICAgIHZhbGlkID0gdGhpcy5vcHRpb25zLnBhdHRlcm5zW3BhdHRlcm5dLnRlc3QoaW5wdXRUZXh0KTtcclxuICAgICAgfVxyXG4gICAgICAvLyBJZiB0aGUgcGF0dGVybiBuYW1lIGlzbid0IGFsc28gdGhlIHR5cGUgYXR0cmlidXRlIG9mIHRoZSBmaWVsZCwgdGhlbiB0ZXN0IGl0IGFzIGEgcmVnZXhwXHJcbiAgICAgIGVsc2UgaWYgKHBhdHRlcm4gIT09ICRlbC5hdHRyKCd0eXBlJykpIHtcclxuICAgICAgICB2YWxpZCA9IG5ldyBSZWdFeHAocGF0dGVybikudGVzdChpbnB1dFRleHQpO1xyXG4gICAgICB9XHJcbiAgICAgIGVsc2Uge1xyXG4gICAgICAgIHZhbGlkID0gdHJ1ZTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgLy8gQW4gZW1wdHkgZmllbGQgaXMgdmFsaWQgaWYgaXQncyBub3QgcmVxdWlyZWRcclxuICAgIGVsc2UgaWYgKCEkZWwucHJvcCgncmVxdWlyZWQnKSkge1xyXG4gICAgICB2YWxpZCA9IHRydWU7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHZhbGlkO1xyXG4gICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERldGVybWluZXMgd2hldGhlciBvciBhIG5vdCBhIHJhZGlvIGlucHV0IGlzIHZhbGlkIGJhc2VkIG9uIHdoZXRoZXIgb3Igbm90IGl0IGlzIHJlcXVpcmVkIGFuZCBzZWxlY3RlZC4gQWx0aG91Z2ggdGhlIGZ1bmN0aW9uIHRhcmdldHMgYSBzaW5nbGUgYDxpbnB1dD5gLCBpdCB2YWxpZGF0ZXMgYnkgY2hlY2tpbmcgdGhlIGByZXF1aXJlZGAgYW5kIGBjaGVja2VkYCBwcm9wZXJ0aWVzIG9mIGFsbCByYWRpbyBidXR0b25zIGluIGl0cyBncm91cC5cclxuICAgKiBAcGFyYW0ge1N0cmluZ30gZ3JvdXBOYW1lIC0gQSBzdHJpbmcgdGhhdCBzcGVjaWZpZXMgdGhlIG5hbWUgb2YgYSByYWRpbyBidXR0b24gZ3JvdXBcclxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gQm9vbGVhbiB2YWx1ZSBkZXBlbmRzIG9uIHdoZXRoZXIgb3Igbm90IGF0IGxlYXN0IG9uZSByYWRpbyBpbnB1dCBoYXMgYmVlbiBzZWxlY3RlZCAoaWYgaXQncyByZXF1aXJlZClcclxuICAgKi9cclxuICB2YWxpZGF0ZVJhZGlvKGdyb3VwTmFtZSkge1xyXG4gICAgLy8gSWYgYXQgbGVhc3Qgb25lIHJhZGlvIGluIHRoZSBncm91cCBoYXMgdGhlIGByZXF1aXJlZGAgYXR0cmlidXRlLCB0aGUgZ3JvdXAgaXMgY29uc2lkZXJlZCByZXF1aXJlZFxyXG4gICAgLy8gUGVyIFczQyBzcGVjLCBhbGwgcmFkaW8gYnV0dG9ucyBpbiBhIGdyb3VwIHNob3VsZCBoYXZlIGByZXF1aXJlZGAsIGJ1dCB3ZSdyZSBiZWluZyBuaWNlXHJcbiAgICB2YXIgJGdyb3VwID0gdGhpcy4kZWxlbWVudC5maW5kKGA6cmFkaW9bbmFtZT1cIiR7Z3JvdXBOYW1lfVwiXWApO1xyXG4gICAgdmFyIHZhbGlkID0gZmFsc2UsIHJlcXVpcmVkID0gZmFsc2U7XHJcblxyXG4gICAgLy8gRm9yIHRoZSBncm91cCB0byBiZSByZXF1aXJlZCwgYXQgbGVhc3Qgb25lIHJhZGlvIG5lZWRzIHRvIGJlIHJlcXVpcmVkXHJcbiAgICAkZ3JvdXAuZWFjaCgoaSwgZSkgPT4ge1xyXG4gICAgICBpZiAoJChlKS5hdHRyKCdyZXF1aXJlZCcpKSB7XHJcbiAgICAgICAgcmVxdWlyZWQgPSB0cnVlO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICAgIGlmKCFyZXF1aXJlZCkgdmFsaWQ9dHJ1ZTtcclxuXHJcbiAgICBpZiAoIXZhbGlkKSB7XHJcbiAgICAgIC8vIEZvciB0aGUgZ3JvdXAgdG8gYmUgdmFsaWQsIGF0IGxlYXN0IG9uZSByYWRpbyBuZWVkcyB0byBiZSBjaGVja2VkXHJcbiAgICAgICRncm91cC5lYWNoKChpLCBlKSA9PiB7XHJcbiAgICAgICAgaWYgKCQoZSkucHJvcCgnY2hlY2tlZCcpKSB7XHJcbiAgICAgICAgICB2YWxpZCA9IHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIHZhbGlkO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGV0ZXJtaW5lcyBpZiBhIHNlbGVjdGVkIGlucHV0IHBhc3NlcyBhIGN1c3RvbSB2YWxpZGF0aW9uIGZ1bmN0aW9uLiBNdWx0aXBsZSB2YWxpZGF0aW9ucyBjYW4gYmUgdXNlZCwgaWYgcGFzc2VkIHRvIHRoZSBlbGVtZW50IHdpdGggYGRhdGEtdmFsaWRhdG9yPVwiZm9vIGJhciBiYXpcImAgaW4gYSBzcGFjZSBzZXBhcmF0ZWQgbGlzdGVkLlxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSAkZWwgLSBqUXVlcnkgaW5wdXQgZWxlbWVudC5cclxuICAgKiBAcGFyYW0ge1N0cmluZ30gdmFsaWRhdG9ycyAtIGEgc3RyaW5nIG9mIGZ1bmN0aW9uIG5hbWVzIG1hdGNoaW5nIGZ1bmN0aW9ucyBpbiB0aGUgQWJpZGUub3B0aW9ucy52YWxpZGF0b3JzIG9iamVjdC5cclxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IHJlcXVpcmVkIC0gc2VsZiBleHBsYW5hdG9yeT9cclxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gLSB0cnVlIGlmIHZhbGlkYXRpb25zIHBhc3NlZC5cclxuICAgKi9cclxuICBtYXRjaFZhbGlkYXRpb24oJGVsLCB2YWxpZGF0b3JzLCByZXF1aXJlZCkge1xyXG4gICAgcmVxdWlyZWQgPSByZXF1aXJlZCA/IHRydWUgOiBmYWxzZTtcclxuXHJcbiAgICB2YXIgY2xlYXIgPSB2YWxpZGF0b3JzLnNwbGl0KCcgJykubWFwKCh2KSA9PiB7XHJcbiAgICAgIHJldHVybiB0aGlzLm9wdGlvbnMudmFsaWRhdG9yc1t2XSgkZWwsIHJlcXVpcmVkLCAkZWwucGFyZW50KCkpO1xyXG4gICAgfSk7XHJcbiAgICByZXR1cm4gY2xlYXIuaW5kZXhPZihmYWxzZSkgPT09IC0xO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVzZXRzIGZvcm0gaW5wdXRzIGFuZCBzdHlsZXNcclxuICAgKiBAZmlyZXMgQWJpZGUjZm9ybXJlc2V0XHJcbiAgICovXHJcbiAgcmVzZXRGb3JtKCkge1xyXG4gICAgdmFyICRmb3JtID0gdGhpcy4kZWxlbWVudCxcclxuICAgICAgICBvcHRzID0gdGhpcy5vcHRpb25zO1xyXG5cclxuICAgICQoYC4ke29wdHMubGFiZWxFcnJvckNsYXNzfWAsICRmb3JtKS5ub3QoJ3NtYWxsJykucmVtb3ZlQ2xhc3Mob3B0cy5sYWJlbEVycm9yQ2xhc3MpO1xyXG4gICAgJChgLiR7b3B0cy5pbnB1dEVycm9yQ2xhc3N9YCwgJGZvcm0pLm5vdCgnc21hbGwnKS5yZW1vdmVDbGFzcyhvcHRzLmlucHV0RXJyb3JDbGFzcyk7XHJcbiAgICAkKGAke29wdHMuZm9ybUVycm9yU2VsZWN0b3J9LiR7b3B0cy5mb3JtRXJyb3JDbGFzc31gKS5yZW1vdmVDbGFzcyhvcHRzLmZvcm1FcnJvckNsYXNzKTtcclxuICAgICRmb3JtLmZpbmQoJ1tkYXRhLWFiaWRlLWVycm9yXScpLmNzcygnZGlzcGxheScsICdub25lJyk7XHJcbiAgICAkKCc6aW5wdXQnLCAkZm9ybSkubm90KCc6YnV0dG9uLCA6c3VibWl0LCA6cmVzZXQsIDpoaWRkZW4sIDpyYWRpbywgOmNoZWNrYm94LCBbZGF0YS1hYmlkZS1pZ25vcmVdJykudmFsKCcnKS5yZW1vdmVBdHRyKCdkYXRhLWludmFsaWQnKTtcclxuICAgICQoJzppbnB1dDpyYWRpbycsICRmb3JtKS5ub3QoJ1tkYXRhLWFiaWRlLWlnbm9yZV0nKS5wcm9wKCdjaGVja2VkJyxmYWxzZSkucmVtb3ZlQXR0cignZGF0YS1pbnZhbGlkJyk7XHJcbiAgICAkKCc6aW5wdXQ6Y2hlY2tib3gnLCAkZm9ybSkubm90KCdbZGF0YS1hYmlkZS1pZ25vcmVdJykucHJvcCgnY2hlY2tlZCcsZmFsc2UpLnJlbW92ZUF0dHIoJ2RhdGEtaW52YWxpZCcpO1xyXG4gICAgLyoqXHJcbiAgICAgKiBGaXJlcyB3aGVuIHRoZSBmb3JtIGhhcyBiZWVuIHJlc2V0LlxyXG4gICAgICogQGV2ZW50IEFiaWRlI2Zvcm1yZXNldFxyXG4gICAgICovXHJcbiAgICAkZm9ybS50cmlnZ2VyKCdmb3JtcmVzZXQuemYuYWJpZGUnLCBbJGZvcm1dKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlc3Ryb3lzIGFuIGluc3RhbmNlIG9mIEFiaWRlLlxyXG4gICAqIFJlbW92ZXMgZXJyb3Igc3R5bGVzIGFuZCBjbGFzc2VzIGZyb20gZWxlbWVudHMsIHdpdGhvdXQgcmVzZXR0aW5nIHRoZWlyIHZhbHVlcy5cclxuICAgKi9cclxuICBkZXN0cm95KCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgIHRoaXMuJGVsZW1lbnRcclxuICAgICAgLm9mZignLmFiaWRlJylcclxuICAgICAgLmZpbmQoJ1tkYXRhLWFiaWRlLWVycm9yXScpXHJcbiAgICAgICAgLmNzcygnZGlzcGxheScsICdub25lJyk7XHJcblxyXG4gICAgdGhpcy4kaW5wdXRzXHJcbiAgICAgIC5vZmYoJy5hYmlkZScpXHJcbiAgICAgIC5lYWNoKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIF90aGlzLnJlbW92ZUVycm9yQ2xhc3NlcygkKHRoaXMpKTtcclxuICAgICAgfSk7XHJcblxyXG4gICAgRm91bmRhdGlvbi51bnJlZ2lzdGVyUGx1Z2luKHRoaXMpO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIERlZmF1bHQgc2V0dGluZ3MgZm9yIHBsdWdpblxyXG4gKi9cclxuQWJpZGUuZGVmYXVsdHMgPSB7XHJcbiAgLyoqXHJcbiAgICogVGhlIGRlZmF1bHQgZXZlbnQgdG8gdmFsaWRhdGUgaW5wdXRzLiBDaGVja2JveGVzIGFuZCByYWRpb3MgdmFsaWRhdGUgaW1tZWRpYXRlbHkuXHJcbiAgICogUmVtb3ZlIG9yIGNoYW5nZSB0aGlzIHZhbHVlIGZvciBtYW51YWwgdmFsaWRhdGlvbi5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ2ZpZWxkQ2hhbmdlJ1xyXG4gICAqL1xyXG4gIHZhbGlkYXRlT246ICdmaWVsZENoYW5nZScsXHJcblxyXG4gIC8qKlxyXG4gICAqIENsYXNzIHRvIGJlIGFwcGxpZWQgdG8gaW5wdXQgbGFiZWxzIG9uIGZhaWxlZCB2YWxpZGF0aW9uLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnaXMtaW52YWxpZC1sYWJlbCdcclxuICAgKi9cclxuICBsYWJlbEVycm9yQ2xhc3M6ICdpcy1pbnZhbGlkLWxhYmVsJyxcclxuXHJcbiAgLyoqXHJcbiAgICogQ2xhc3MgdG8gYmUgYXBwbGllZCB0byBpbnB1dHMgb24gZmFpbGVkIHZhbGlkYXRpb24uXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICdpcy1pbnZhbGlkLWlucHV0J1xyXG4gICAqL1xyXG4gIGlucHV0RXJyb3JDbGFzczogJ2lzLWludmFsaWQtaW5wdXQnLFxyXG5cclxuICAvKipcclxuICAgKiBDbGFzcyBzZWxlY3RvciB0byB1c2UgdG8gdGFyZ2V0IEZvcm0gRXJyb3JzIGZvciBzaG93L2hpZGUuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICcuZm9ybS1lcnJvcidcclxuICAgKi9cclxuICBmb3JtRXJyb3JTZWxlY3RvcjogJy5mb3JtLWVycm9yJyxcclxuXHJcbiAgLyoqXHJcbiAgICogQ2xhc3MgYWRkZWQgdG8gRm9ybSBFcnJvcnMgb24gZmFpbGVkIHZhbGlkYXRpb24uXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICdpcy12aXNpYmxlJ1xyXG4gICAqL1xyXG4gIGZvcm1FcnJvckNsYXNzOiAnaXMtdmlzaWJsZScsXHJcblxyXG4gIC8qKlxyXG4gICAqIFNldCB0byB0cnVlIHRvIHZhbGlkYXRlIHRleHQgaW5wdXRzIG9uIGFueSB2YWx1ZSBjaGFuZ2UuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgbGl2ZVZhbGlkYXRlOiBmYWxzZSxcclxuXHJcbiAgLyoqXHJcbiAgICogU2V0IHRvIHRydWUgdG8gdmFsaWRhdGUgaW5wdXRzIG9uIGJsdXIuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgdmFsaWRhdGVPbkJsdXI6IGZhbHNlLFxyXG5cclxuICBwYXR0ZXJuczoge1xyXG4gICAgYWxwaGEgOiAvXlthLXpBLVpdKyQvLFxyXG4gICAgYWxwaGFfbnVtZXJpYyA6IC9eW2EtekEtWjAtOV0rJC8sXHJcbiAgICBpbnRlZ2VyIDogL15bLStdP1xcZCskLyxcclxuICAgIG51bWJlciA6IC9eWy0rXT9cXGQqKD86W1xcLlxcLF1cXGQrKT8kLyxcclxuXHJcbiAgICAvLyBhbWV4LCB2aXNhLCBkaW5lcnNcclxuICAgIGNhcmQgOiAvXig/OjRbMC05XXsxMn0oPzpbMC05XXszfSk/fDVbMS01XVswLTldezE0fXw2KD86MDExfDVbMC05XVswLTldKVswLTldezEyfXwzWzQ3XVswLTldezEzfXwzKD86MFswLTVdfFs2OF1bMC05XSlbMC05XXsxMX18KD86MjEzMXwxODAwfDM1XFxkezN9KVxcZHsxMX0pJC8sXHJcbiAgICBjdnYgOiAvXihbMC05XSl7Myw0fSQvLFxyXG5cclxuICAgIC8vIGh0dHA6Ly93d3cud2hhdHdnLm9yZy9zcGVjcy93ZWItYXBwcy9jdXJyZW50LXdvcmsvbXVsdGlwYWdlL3N0YXRlcy1vZi10aGUtdHlwZS1hdHRyaWJ1dGUuaHRtbCN2YWxpZC1lLW1haWwtYWRkcmVzc1xyXG4gICAgZW1haWwgOiAvXlthLXpBLVowLTkuISMkJSYnKitcXC89P15fYHt8fX4tXStAW2EtekEtWjAtOV0oPzpbYS16QS1aMC05LV17MCw2MX1bYS16QS1aMC05XSk/KD86XFwuW2EtekEtWjAtOV0oPzpbYS16QS1aMC05LV17MCw2MX1bYS16QS1aMC05XSk/KSskLyxcclxuXHJcbiAgICB1cmwgOiAvXihodHRwcz98ZnRwfGZpbGV8c3NoKTpcXC9cXC8oKCgoW2EtekEtWl18XFxkfC18XFwufF98fnxbXFx1MDBBMC1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkVGXSl8KCVbXFxkYS1mXXsyfSl8WyFcXCQmJ1xcKFxcKVxcKlxcKyw7PV18OikqQCk/KCgoXFxkfFsxLTldXFxkfDFcXGRcXGR8MlswLTRdXFxkfDI1WzAtNV0pXFwuKFxcZHxbMS05XVxcZHwxXFxkXFxkfDJbMC00XVxcZHwyNVswLTVdKVxcLihcXGR8WzEtOV1cXGR8MVxcZFxcZHwyWzAtNF1cXGR8MjVbMC01XSlcXC4oXFxkfFsxLTldXFxkfDFcXGRcXGR8MlswLTRdXFxkfDI1WzAtNV0pKXwoKChbYS16QS1aXXxcXGR8W1xcdTAwQTAtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZFRl0pfCgoW2EtekEtWl18XFxkfFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKShbYS16QS1aXXxcXGR8LXxcXC58X3x+fFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKSooW2EtekEtWl18XFxkfFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKSkpXFwuKSsoKFthLXpBLVpdfFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKXwoKFthLXpBLVpdfFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKShbYS16QS1aXXxcXGR8LXxcXC58X3x+fFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKSooW2EtekEtWl18W1xcdTAwQTAtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZFRl0pKSlcXC4/KSg6XFxkKik/KShcXC8oKChbYS16QS1aXXxcXGR8LXxcXC58X3x+fFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKXwoJVtcXGRhLWZdezJ9KXxbIVxcJCYnXFwoXFwpXFwqXFwrLDs9XXw6fEApKyhcXC8oKFthLXpBLVpdfFxcZHwtfFxcLnxffH58W1xcdTAwQTAtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZFRl0pfCglW1xcZGEtZl17Mn0pfFshXFwkJidcXChcXClcXCpcXCssOz1dfDp8QCkqKSopPyk/KFxcPygoKFthLXpBLVpdfFxcZHwtfFxcLnxffH58W1xcdTAwQTAtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZFRl0pfCglW1xcZGEtZl17Mn0pfFshXFwkJidcXChcXClcXCpcXCssOz1dfDp8QCl8W1xcdUUwMDAtXFx1RjhGRl18XFwvfFxcPykqKT8oXFwjKCgoW2EtekEtWl18XFxkfC18XFwufF98fnxbXFx1MDBBMC1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkVGXSl8KCVbXFxkYS1mXXsyfSl8WyFcXCQmJ1xcKFxcKVxcKlxcKyw7PV18OnxAKXxcXC98XFw/KSopPyQvLFxyXG4gICAgLy8gYWJjLmRlXHJcbiAgICBkb21haW4gOiAvXihbYS16QS1aMC05XShbYS16QS1aMC05XFwtXXswLDYxfVthLXpBLVowLTldKT9cXC4pK1thLXpBLVpdezIsOH0kLyxcclxuXHJcbiAgICBkYXRldGltZSA6IC9eKFswLTJdWzAtOV17M30pXFwtKFswLTFdWzAtOV0pXFwtKFswLTNdWzAtOV0pVChbMC01XVswLTldKVxcOihbMC01XVswLTldKVxcOihbMC01XVswLTldKShafChbXFwtXFwrXShbMC0xXVswLTldKVxcOjAwKSkkLyxcclxuICAgIC8vIFlZWVktTU0tRERcclxuICAgIGRhdGUgOiAvKD86MTl8MjApWzAtOV17Mn0tKD86KD86MFsxLTldfDFbMC0yXSktKD86MFsxLTldfDFbMC05XXwyWzAtOV0pfCg/Oig/ITAyKSg/OjBbMS05XXwxWzAtMl0pLSg/OjMwKSl8KD86KD86MFsxMzU3OF18MVswMl0pLTMxKSkkLyxcclxuICAgIC8vIEhIOk1NOlNTXHJcbiAgICB0aW1lIDogL14oMFswLTldfDFbMC05XXwyWzAtM10pKDpbMC01XVswLTldKXsyfSQvLFxyXG4gICAgZGF0ZUlTTyA6IC9eXFxkezR9W1xcL1xcLV1cXGR7MSwyfVtcXC9cXC1dXFxkezEsMn0kLyxcclxuICAgIC8vIE1NL0REL1lZWVlcclxuICAgIG1vbnRoX2RheV95ZWFyIDogL14oMFsxLTldfDFbMDEyXSlbLSBcXC8uXSgwWzEtOV18WzEyXVswLTldfDNbMDFdKVstIFxcLy5dXFxkezR9JC8sXHJcbiAgICAvLyBERC9NTS9ZWVlZXHJcbiAgICBkYXlfbW9udGhfeWVhciA6IC9eKDBbMS05XXxbMTJdWzAtOV18M1swMV0pWy0gXFwvLl0oMFsxLTldfDFbMDEyXSlbLSBcXC8uXVxcZHs0fSQvLFxyXG5cclxuICAgIC8vICNGRkYgb3IgI0ZGRkZGRlxyXG4gICAgY29sb3IgOiAvXiM/KFthLWZBLUYwLTldezZ9fFthLWZBLUYwLTldezN9KSQvXHJcbiAgfSxcclxuXHJcbiAgLyoqXHJcbiAgICogT3B0aW9uYWwgdmFsaWRhdGlvbiBmdW5jdGlvbnMgdG8gYmUgdXNlZC4gYGVxdWFsVG9gIGJlaW5nIHRoZSBvbmx5IGRlZmF1bHQgaW5jbHVkZWQgZnVuY3Rpb24uXHJcbiAgICogRnVuY3Rpb25zIHNob3VsZCByZXR1cm4gb25seSBhIGJvb2xlYW4gaWYgdGhlIGlucHV0IGlzIHZhbGlkIG9yIG5vdC4gRnVuY3Rpb25zIGFyZSBnaXZlbiB0aGUgZm9sbG93aW5nIGFyZ3VtZW50czpcclxuICAgKiBlbCA6IFRoZSBqUXVlcnkgZWxlbWVudCB0byB2YWxpZGF0ZS5cclxuICAgKiByZXF1aXJlZCA6IEJvb2xlYW4gdmFsdWUgb2YgdGhlIHJlcXVpcmVkIGF0dHJpYnV0ZSBiZSBwcmVzZW50IG9yIG5vdC5cclxuICAgKiBwYXJlbnQgOiBUaGUgZGlyZWN0IHBhcmVudCBvZiB0aGUgaW5wdXQuXHJcbiAgICogQG9wdGlvblxyXG4gICAqL1xyXG4gIHZhbGlkYXRvcnM6IHtcclxuICAgIGVxdWFsVG86IGZ1bmN0aW9uIChlbCwgcmVxdWlyZWQsIHBhcmVudCkge1xyXG4gICAgICByZXR1cm4gJChgIyR7ZWwuYXR0cignZGF0YS1lcXVhbHRvJyl9YCkudmFsKCkgPT09IGVsLnZhbCgpO1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG5cclxuLy8gV2luZG93IGV4cG9ydHNcclxuRm91bmRhdGlvbi5wbHVnaW4oQWJpZGUsICdBYmlkZScpO1xyXG5cclxufShqUXVlcnkpO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG4hZnVuY3Rpb24oJCkge1xyXG5cclxuLyoqXHJcbiAqIEFjY29yZGlvbiBtb2R1bGUuXHJcbiAqIEBtb2R1bGUgZm91bmRhdGlvbi5hY2NvcmRpb25cclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5rZXlib2FyZFxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLm1vdGlvblxyXG4gKi9cclxuXHJcbmNsYXNzIEFjY29yZGlvbiB7XHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlcyBhIG5ldyBpbnN0YW5jZSBvZiBhbiBhY2NvcmRpb24uXHJcbiAgICogQGNsYXNzXHJcbiAgICogQGZpcmVzIEFjY29yZGlvbiNpbml0XHJcbiAgICogQHBhcmFtIHtqUXVlcnl9IGVsZW1lbnQgLSBqUXVlcnkgb2JqZWN0IHRvIG1ha2UgaW50byBhbiBhY2NvcmRpb24uXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgLSBhIHBsYWluIG9iamVjdCB3aXRoIHNldHRpbmdzIHRvIG92ZXJyaWRlIHRoZSBkZWZhdWx0IG9wdGlvbnMuXHJcbiAgICovXHJcbiAgY29uc3RydWN0b3IoZWxlbWVudCwgb3B0aW9ucykge1xyXG4gICAgdGhpcy4kZWxlbWVudCA9IGVsZW1lbnQ7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgQWNjb3JkaW9uLmRlZmF1bHRzLCB0aGlzLiRlbGVtZW50LmRhdGEoKSwgb3B0aW9ucyk7XHJcblxyXG4gICAgdGhpcy5faW5pdCgpO1xyXG5cclxuICAgIEZvdW5kYXRpb24ucmVnaXN0ZXJQbHVnaW4odGhpcywgJ0FjY29yZGlvbicpO1xyXG4gICAgRm91bmRhdGlvbi5LZXlib2FyZC5yZWdpc3RlcignQWNjb3JkaW9uJywge1xyXG4gICAgICAnRU5URVInOiAndG9nZ2xlJyxcclxuICAgICAgJ1NQQUNFJzogJ3RvZ2dsZScsXHJcbiAgICAgICdBUlJPV19ET1dOJzogJ25leHQnLFxyXG4gICAgICAnQVJST1dfVVAnOiAncHJldmlvdXMnXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEluaXRpYWxpemVzIHRoZSBhY2NvcmRpb24gYnkgYW5pbWF0aW5nIHRoZSBwcmVzZXQgYWN0aXZlIHBhbmUocykuXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfaW5pdCgpIHtcclxuICAgIHRoaXMuJGVsZW1lbnQuYXR0cigncm9sZScsICd0YWJsaXN0Jyk7XHJcbiAgICB0aGlzLiR0YWJzID0gdGhpcy4kZWxlbWVudC5jaGlsZHJlbignW2RhdGEtYWNjb3JkaW9uLWl0ZW1dJyk7XHJcblxyXG4gICAgdGhpcy4kdGFicy5lYWNoKGZ1bmN0aW9uKGlkeCwgZWwpIHtcclxuICAgICAgdmFyICRlbCA9ICQoZWwpLFxyXG4gICAgICAgICAgJGNvbnRlbnQgPSAkZWwuY2hpbGRyZW4oJ1tkYXRhLXRhYi1jb250ZW50XScpLFxyXG4gICAgICAgICAgaWQgPSAkY29udGVudFswXS5pZCB8fCBGb3VuZGF0aW9uLkdldFlvRGlnaXRzKDYsICdhY2NvcmRpb24nKSxcclxuICAgICAgICAgIGxpbmtJZCA9IGVsLmlkIHx8IGAke2lkfS1sYWJlbGA7XHJcblxyXG4gICAgICAkZWwuZmluZCgnYTpmaXJzdCcpLmF0dHIoe1xyXG4gICAgICAgICdhcmlhLWNvbnRyb2xzJzogaWQsXHJcbiAgICAgICAgJ3JvbGUnOiAndGFiJyxcclxuICAgICAgICAnaWQnOiBsaW5rSWQsXHJcbiAgICAgICAgJ2FyaWEtZXhwYW5kZWQnOiBmYWxzZSxcclxuICAgICAgICAnYXJpYS1zZWxlY3RlZCc6IGZhbHNlXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgJGNvbnRlbnQuYXR0cih7J3JvbGUnOiAndGFicGFuZWwnLCAnYXJpYS1sYWJlbGxlZGJ5JzogbGlua0lkLCAnYXJpYS1oaWRkZW4nOiB0cnVlLCAnaWQnOiBpZH0pO1xyXG4gICAgfSk7XHJcbiAgICB2YXIgJGluaXRBY3RpdmUgPSB0aGlzLiRlbGVtZW50LmZpbmQoJy5pcy1hY3RpdmUnKS5jaGlsZHJlbignW2RhdGEtdGFiLWNvbnRlbnRdJyk7XHJcbiAgICBpZigkaW5pdEFjdGl2ZS5sZW5ndGgpe1xyXG4gICAgICB0aGlzLmRvd24oJGluaXRBY3RpdmUsIHRydWUpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5fZXZlbnRzKCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGRzIGV2ZW50IGhhbmRsZXJzIGZvciBpdGVtcyB3aXRoaW4gdGhlIGFjY29yZGlvbi5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9ldmVudHMoKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG5cclxuICAgIHRoaXMuJHRhYnMuZWFjaChmdW5jdGlvbigpIHtcclxuICAgICAgdmFyICRlbGVtID0gJCh0aGlzKTtcclxuICAgICAgdmFyICR0YWJDb250ZW50ID0gJGVsZW0uY2hpbGRyZW4oJ1tkYXRhLXRhYi1jb250ZW50XScpO1xyXG4gICAgICBpZiAoJHRhYkNvbnRlbnQubGVuZ3RoKSB7XHJcbiAgICAgICAgJGVsZW0uY2hpbGRyZW4oJ2EnKS5vZmYoJ2NsaWNrLnpmLmFjY29yZGlvbiBrZXlkb3duLnpmLmFjY29yZGlvbicpXHJcbiAgICAgICAgICAgICAgIC5vbignY2xpY2suemYuYWNjb3JkaW9uJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgX3RoaXMudG9nZ2xlKCR0YWJDb250ZW50KTtcclxuICAgICAgICB9KS5vbigna2V5ZG93bi56Zi5hY2NvcmRpb24nLCBmdW5jdGlvbihlKXtcclxuICAgICAgICAgIEZvdW5kYXRpb24uS2V5Ym9hcmQuaGFuZGxlS2V5KGUsICdBY2NvcmRpb24nLCB7XHJcbiAgICAgICAgICAgIHRvZ2dsZTogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgX3RoaXMudG9nZ2xlKCR0YWJDb250ZW50KTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgbmV4dDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgdmFyICRhID0gJGVsZW0ubmV4dCgpLmZpbmQoJ2EnKS5mb2N1cygpO1xyXG4gICAgICAgICAgICAgIGlmICghX3RoaXMub3B0aW9ucy5tdWx0aUV4cGFuZCkge1xyXG4gICAgICAgICAgICAgICAgJGEudHJpZ2dlcignY2xpY2suemYuYWNjb3JkaW9uJylcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHByZXZpb3VzOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICB2YXIgJGEgPSAkZWxlbS5wcmV2KCkuZmluZCgnYScpLmZvY3VzKCk7XHJcbiAgICAgICAgICAgICAgaWYgKCFfdGhpcy5vcHRpb25zLm11bHRpRXhwYW5kKSB7XHJcbiAgICAgICAgICAgICAgICAkYS50cmlnZ2VyKCdjbGljay56Zi5hY2NvcmRpb24nKVxyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgaGFuZGxlZDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFRvZ2dsZXMgdGhlIHNlbGVjdGVkIGNvbnRlbnQgcGFuZSdzIG9wZW4vY2xvc2Ugc3RhdGUuXHJcbiAgICogQHBhcmFtIHtqUXVlcnl9ICR0YXJnZXQgLSBqUXVlcnkgb2JqZWN0IG9mIHRoZSBwYW5lIHRvIHRvZ2dsZSAoYC5hY2NvcmRpb24tY29udGVudGApLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIHRvZ2dsZSgkdGFyZ2V0KSB7XHJcbiAgICBpZigkdGFyZ2V0LnBhcmVudCgpLmhhc0NsYXNzKCdpcy1hY3RpdmUnKSkge1xyXG4gICAgICB0aGlzLnVwKCR0YXJnZXQpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5kb3duKCR0YXJnZXQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogT3BlbnMgdGhlIGFjY29yZGlvbiB0YWIgZGVmaW5lZCBieSBgJHRhcmdldGAuXHJcbiAgICogQHBhcmFtIHtqUXVlcnl9ICR0YXJnZXQgLSBBY2NvcmRpb24gcGFuZSB0byBvcGVuIChgLmFjY29yZGlvbi1jb250ZW50YCkuXHJcbiAgICogQHBhcmFtIHtCb29sZWFufSBmaXJzdFRpbWUgLSBmbGFnIHRvIGRldGVybWluZSBpZiByZWZsb3cgc2hvdWxkIGhhcHBlbi5cclxuICAgKiBAZmlyZXMgQWNjb3JkaW9uI2Rvd25cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICBkb3duKCR0YXJnZXQsIGZpcnN0VGltZSkge1xyXG4gICAgJHRhcmdldFxyXG4gICAgICAuYXR0cignYXJpYS1oaWRkZW4nLCBmYWxzZSlcclxuICAgICAgLnBhcmVudCgnW2RhdGEtdGFiLWNvbnRlbnRdJylcclxuICAgICAgLmFkZEJhY2soKVxyXG4gICAgICAucGFyZW50KCkuYWRkQ2xhc3MoJ2lzLWFjdGl2ZScpO1xyXG5cclxuICAgIGlmICghdGhpcy5vcHRpb25zLm11bHRpRXhwYW5kICYmICFmaXJzdFRpbWUpIHtcclxuICAgICAgdmFyICRjdXJyZW50QWN0aXZlID0gdGhpcy4kZWxlbWVudC5jaGlsZHJlbignLmlzLWFjdGl2ZScpLmNoaWxkcmVuKCdbZGF0YS10YWItY29udGVudF0nKTtcclxuICAgICAgaWYgKCRjdXJyZW50QWN0aXZlLmxlbmd0aCkge1xyXG4gICAgICAgIHRoaXMudXAoJGN1cnJlbnRBY3RpdmUubm90KCR0YXJnZXQpKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgICR0YXJnZXQuc2xpZGVEb3duKHRoaXMub3B0aW9ucy5zbGlkZVNwZWVkLCAoKSA9PiB7XHJcbiAgICAgIC8qKlxyXG4gICAgICAgKiBGaXJlcyB3aGVuIHRoZSB0YWIgaXMgZG9uZSBvcGVuaW5nLlxyXG4gICAgICAgKiBAZXZlbnQgQWNjb3JkaW9uI2Rvd25cclxuICAgICAgICovXHJcbiAgICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcignZG93bi56Zi5hY2NvcmRpb24nLCBbJHRhcmdldF0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgJChgIyR7JHRhcmdldC5hdHRyKCdhcmlhLWxhYmVsbGVkYnknKX1gKS5hdHRyKHtcclxuICAgICAgJ2FyaWEtZXhwYW5kZWQnOiB0cnVlLFxyXG4gICAgICAnYXJpYS1zZWxlY3RlZCc6IHRydWVcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2xvc2VzIHRoZSB0YWIgZGVmaW5lZCBieSBgJHRhcmdldGAuXHJcbiAgICogQHBhcmFtIHtqUXVlcnl9ICR0YXJnZXQgLSBBY2NvcmRpb24gdGFiIHRvIGNsb3NlIChgLmFjY29yZGlvbi1jb250ZW50YCkuXHJcbiAgICogQGZpcmVzIEFjY29yZGlvbiN1cFxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIHVwKCR0YXJnZXQpIHtcclxuICAgIHZhciAkYXVudHMgPSAkdGFyZ2V0LnBhcmVudCgpLnNpYmxpbmdzKCksXHJcbiAgICAgICAgX3RoaXMgPSB0aGlzO1xyXG5cclxuICAgIGlmKCghdGhpcy5vcHRpb25zLmFsbG93QWxsQ2xvc2VkICYmICEkYXVudHMuaGFzQ2xhc3MoJ2lzLWFjdGl2ZScpKSB8fCAhJHRhcmdldC5wYXJlbnQoKS5oYXNDbGFzcygnaXMtYWN0aXZlJykpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEZvdW5kYXRpb24uTW92ZSh0aGlzLm9wdGlvbnMuc2xpZGVTcGVlZCwgJHRhcmdldCwgZnVuY3Rpb24oKXtcclxuICAgICAgJHRhcmdldC5zbGlkZVVwKF90aGlzLm9wdGlvbnMuc2xpZGVTcGVlZCwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEZpcmVzIHdoZW4gdGhlIHRhYiBpcyBkb25lIGNvbGxhcHNpbmcgdXAuXHJcbiAgICAgICAgICogQGV2ZW50IEFjY29yZGlvbiN1cFxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIF90aGlzLiRlbGVtZW50LnRyaWdnZXIoJ3VwLnpmLmFjY29yZGlvbicsIFskdGFyZ2V0XSk7XHJcbiAgICAgIH0pO1xyXG4gICAgLy8gfSk7XHJcblxyXG4gICAgJHRhcmdldC5hdHRyKCdhcmlhLWhpZGRlbicsIHRydWUpXHJcbiAgICAgICAgICAgLnBhcmVudCgpLnJlbW92ZUNsYXNzKCdpcy1hY3RpdmUnKTtcclxuXHJcbiAgICAkKGAjJHskdGFyZ2V0LmF0dHIoJ2FyaWEtbGFiZWxsZWRieScpfWApLmF0dHIoe1xyXG4gICAgICdhcmlhLWV4cGFuZGVkJzogZmFsc2UsXHJcbiAgICAgJ2FyaWEtc2VsZWN0ZWQnOiBmYWxzZVxyXG4gICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlc3Ryb3lzIGFuIGluc3RhbmNlIG9mIGFuIGFjY29yZGlvbi5cclxuICAgKiBAZmlyZXMgQWNjb3JkaW9uI2Rlc3Ryb3llZFxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIGRlc3Ryb3koKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50LmZpbmQoJ1tkYXRhLXRhYi1jb250ZW50XScpLnN0b3AodHJ1ZSkuc2xpZGVVcCgwKS5jc3MoJ2Rpc3BsYXknLCAnJyk7XHJcbiAgICB0aGlzLiRlbGVtZW50LmZpbmQoJ2EnKS5vZmYoJy56Zi5hY2NvcmRpb24nKTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLnVucmVnaXN0ZXJQbHVnaW4odGhpcyk7XHJcbiAgfVxyXG59XHJcblxyXG5BY2NvcmRpb24uZGVmYXVsdHMgPSB7XHJcbiAgLyoqXHJcbiAgICogQW1vdW50IG9mIHRpbWUgdG8gYW5pbWF0ZSB0aGUgb3BlbmluZyBvZiBhbiBhY2NvcmRpb24gcGFuZS5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgMjUwXHJcbiAgICovXHJcbiAgc2xpZGVTcGVlZDogMjUwLFxyXG4gIC8qKlxyXG4gICAqIEFsbG93IHRoZSBhY2NvcmRpb24gdG8gaGF2ZSBtdWx0aXBsZSBvcGVuIHBhbmVzLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIG11bHRpRXhwYW5kOiBmYWxzZSxcclxuICAvKipcclxuICAgKiBBbGxvdyB0aGUgYWNjb3JkaW9uIHRvIGNsb3NlIGFsbCBwYW5lcy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBhbGxvd0FsbENsb3NlZDogZmFsc2VcclxufTtcclxuXHJcbi8vIFdpbmRvdyBleHBvcnRzXHJcbkZvdW5kYXRpb24ucGx1Z2luKEFjY29yZGlvbiwgJ0FjY29yZGlvbicpO1xyXG5cclxufShqUXVlcnkpO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG4hZnVuY3Rpb24oJCkge1xyXG5cclxuLyoqXHJcbiAqIEFjY29yZGlvbk1lbnUgbW9kdWxlLlxyXG4gKiBAbW9kdWxlIGZvdW5kYXRpb24uYWNjb3JkaW9uTWVudVxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLmtleWJvYXJkXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwubW90aW9uXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwubmVzdFxyXG4gKi9cclxuXHJcbmNsYXNzIEFjY29yZGlvbk1lbnUge1xyXG4gIC8qKlxyXG4gICAqIENyZWF0ZXMgYSBuZXcgaW5zdGFuY2Ugb2YgYW4gYWNjb3JkaW9uIG1lbnUuXHJcbiAgICogQGNsYXNzXHJcbiAgICogQGZpcmVzIEFjY29yZGlvbk1lbnUjaW5pdFxyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSBlbGVtZW50IC0galF1ZXJ5IG9iamVjdCB0byBtYWtlIGludG8gYW4gYWNjb3JkaW9uIG1lbnUuXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgLSBPdmVycmlkZXMgdG8gdGhlIGRlZmF1bHQgcGx1Z2luIHNldHRpbmdzLlxyXG4gICAqL1xyXG4gIGNvbnN0cnVjdG9yKGVsZW1lbnQsIG9wdGlvbnMpIHtcclxuICAgIHRoaXMuJGVsZW1lbnQgPSBlbGVtZW50O1xyXG4gICAgdGhpcy5vcHRpb25zID0gJC5leHRlbmQoe30sIEFjY29yZGlvbk1lbnUuZGVmYXVsdHMsIHRoaXMuJGVsZW1lbnQuZGF0YSgpLCBvcHRpb25zKTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLk5lc3QuRmVhdGhlcih0aGlzLiRlbGVtZW50LCAnYWNjb3JkaW9uJyk7XHJcblxyXG4gICAgdGhpcy5faW5pdCgpO1xyXG5cclxuICAgIEZvdW5kYXRpb24ucmVnaXN0ZXJQbHVnaW4odGhpcywgJ0FjY29yZGlvbk1lbnUnKTtcclxuICAgIEZvdW5kYXRpb24uS2V5Ym9hcmQucmVnaXN0ZXIoJ0FjY29yZGlvbk1lbnUnLCB7XHJcbiAgICAgICdFTlRFUic6ICd0b2dnbGUnLFxyXG4gICAgICAnU1BBQ0UnOiAndG9nZ2xlJyxcclxuICAgICAgJ0FSUk9XX1JJR0hUJzogJ29wZW4nLFxyXG4gICAgICAnQVJST1dfVVAnOiAndXAnLFxyXG4gICAgICAnQVJST1dfRE9XTic6ICdkb3duJyxcclxuICAgICAgJ0FSUk9XX0xFRlQnOiAnY2xvc2UnLFxyXG4gICAgICAnRVNDQVBFJzogJ2Nsb3NlQWxsJ1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuXHJcblxyXG4gIC8qKlxyXG4gICAqIEluaXRpYWxpemVzIHRoZSBhY2NvcmRpb24gbWVudSBieSBoaWRpbmcgYWxsIG5lc3RlZCBtZW51cy5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9pbml0KCkge1xyXG4gICAgdGhpcy4kZWxlbWVudC5maW5kKCdbZGF0YS1zdWJtZW51XScpLm5vdCgnLmlzLWFjdGl2ZScpLnNsaWRlVXAoMCk7Ly8uZmluZCgnYScpLmNzcygncGFkZGluZy1sZWZ0JywgJzFyZW0nKTtcclxuICAgIHRoaXMuJGVsZW1lbnQuYXR0cih7XHJcbiAgICAgICdyb2xlJzogJ21lbnUnLFxyXG4gICAgICAnYXJpYS1tdWx0aXNlbGVjdGFibGUnOiB0aGlzLm9wdGlvbnMubXVsdGlPcGVuXHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLiRtZW51TGlua3MgPSB0aGlzLiRlbGVtZW50LmZpbmQoJy5pcy1hY2NvcmRpb24tc3VibWVudS1wYXJlbnQnKTtcclxuICAgIHRoaXMuJG1lbnVMaW5rcy5lYWNoKGZ1bmN0aW9uKCl7XHJcbiAgICAgIHZhciBsaW5rSWQgPSB0aGlzLmlkIHx8IEZvdW5kYXRpb24uR2V0WW9EaWdpdHMoNiwgJ2FjYy1tZW51LWxpbmsnKSxcclxuICAgICAgICAgICRlbGVtID0gJCh0aGlzKSxcclxuICAgICAgICAgICRzdWIgPSAkZWxlbS5jaGlsZHJlbignW2RhdGEtc3VibWVudV0nKSxcclxuICAgICAgICAgIHN1YklkID0gJHN1YlswXS5pZCB8fCBGb3VuZGF0aW9uLkdldFlvRGlnaXRzKDYsICdhY2MtbWVudScpLFxyXG4gICAgICAgICAgaXNBY3RpdmUgPSAkc3ViLmhhc0NsYXNzKCdpcy1hY3RpdmUnKTtcclxuICAgICAgJGVsZW0uYXR0cih7XHJcbiAgICAgICAgJ2FyaWEtY29udHJvbHMnOiBzdWJJZCxcclxuICAgICAgICAnYXJpYS1leHBhbmRlZCc6IGlzQWN0aXZlLFxyXG4gICAgICAgICdyb2xlJzogJ21lbnVpdGVtJyxcclxuICAgICAgICAnaWQnOiBsaW5rSWRcclxuICAgICAgfSk7XHJcbiAgICAgICRzdWIuYXR0cih7XHJcbiAgICAgICAgJ2FyaWEtbGFiZWxsZWRieSc6IGxpbmtJZCxcclxuICAgICAgICAnYXJpYS1oaWRkZW4nOiAhaXNBY3RpdmUsXHJcbiAgICAgICAgJ3JvbGUnOiAnbWVudScsXHJcbiAgICAgICAgJ2lkJzogc3ViSWRcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICAgIHZhciBpbml0UGFuZXMgPSB0aGlzLiRlbGVtZW50LmZpbmQoJy5pcy1hY3RpdmUnKTtcclxuICAgIGlmKGluaXRQYW5lcy5sZW5ndGgpe1xyXG4gICAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgICBpbml0UGFuZXMuZWFjaChmdW5jdGlvbigpe1xyXG4gICAgICAgIF90aGlzLmRvd24oJCh0aGlzKSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgdGhpcy5fZXZlbnRzKCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGRzIGV2ZW50IGhhbmRsZXJzIGZvciBpdGVtcyB3aXRoaW4gdGhlIG1lbnUuXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfZXZlbnRzKCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuXHJcbiAgICB0aGlzLiRlbGVtZW50LmZpbmQoJ2xpJykuZWFjaChmdW5jdGlvbigpIHtcclxuICAgICAgdmFyICRzdWJtZW51ID0gJCh0aGlzKS5jaGlsZHJlbignW2RhdGEtc3VibWVudV0nKTtcclxuXHJcbiAgICAgIGlmICgkc3VibWVudS5sZW5ndGgpIHtcclxuICAgICAgICAkKHRoaXMpLmNoaWxkcmVuKCdhJykub2ZmKCdjbGljay56Zi5hY2NvcmRpb25NZW51Jykub24oJ2NsaWNrLnpmLmFjY29yZGlvbk1lbnUnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcblxyXG4gICAgICAgICAgX3RoaXMudG9nZ2xlKCRzdWJtZW51KTtcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgfSkub24oJ2tleWRvd24uemYuYWNjb3JkaW9ubWVudScsIGZ1bmN0aW9uKGUpe1xyXG4gICAgICB2YXIgJGVsZW1lbnQgPSAkKHRoaXMpLFxyXG4gICAgICAgICAgJGVsZW1lbnRzID0gJGVsZW1lbnQucGFyZW50KCd1bCcpLmNoaWxkcmVuKCdsaScpLFxyXG4gICAgICAgICAgJHByZXZFbGVtZW50LFxyXG4gICAgICAgICAgJG5leHRFbGVtZW50LFxyXG4gICAgICAgICAgJHRhcmdldCA9ICRlbGVtZW50LmNoaWxkcmVuKCdbZGF0YS1zdWJtZW51XScpO1xyXG5cclxuICAgICAgJGVsZW1lbnRzLmVhY2goZnVuY3Rpb24oaSkge1xyXG4gICAgICAgIGlmICgkKHRoaXMpLmlzKCRlbGVtZW50KSkge1xyXG4gICAgICAgICAgJHByZXZFbGVtZW50ID0gJGVsZW1lbnRzLmVxKE1hdGgubWF4KDAsIGktMSkpLmZpbmQoJ2EnKS5maXJzdCgpO1xyXG4gICAgICAgICAgJG5leHRFbGVtZW50ID0gJGVsZW1lbnRzLmVxKE1hdGgubWluKGkrMSwgJGVsZW1lbnRzLmxlbmd0aC0xKSkuZmluZCgnYScpLmZpcnN0KCk7XHJcblxyXG4gICAgICAgICAgaWYgKCQodGhpcykuY2hpbGRyZW4oJ1tkYXRhLXN1Ym1lbnVdOnZpc2libGUnKS5sZW5ndGgpIHsgLy8gaGFzIG9wZW4gc3ViIG1lbnVcclxuICAgICAgICAgICAgJG5leHRFbGVtZW50ID0gJGVsZW1lbnQuZmluZCgnbGk6Zmlyc3QtY2hpbGQnKS5maW5kKCdhJykuZmlyc3QoKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGlmICgkKHRoaXMpLmlzKCc6Zmlyc3QtY2hpbGQnKSkgeyAvLyBpcyBmaXJzdCBlbGVtZW50IG9mIHN1YiBtZW51XHJcbiAgICAgICAgICAgICRwcmV2RWxlbWVudCA9ICRlbGVtZW50LnBhcmVudHMoJ2xpJykuZmlyc3QoKS5maW5kKCdhJykuZmlyc3QoKTtcclxuICAgICAgICAgIH0gZWxzZSBpZiAoJHByZXZFbGVtZW50LnBhcmVudHMoJ2xpJykuZmlyc3QoKS5jaGlsZHJlbignW2RhdGEtc3VibWVudV06dmlzaWJsZScpLmxlbmd0aCkgeyAvLyBpZiBwcmV2aW91cyBlbGVtZW50IGhhcyBvcGVuIHN1YiBtZW51XHJcbiAgICAgICAgICAgICRwcmV2RWxlbWVudCA9ICRwcmV2RWxlbWVudC5wYXJlbnRzKCdsaScpLmZpbmQoJ2xpOmxhc3QtY2hpbGQnKS5maW5kKCdhJykuZmlyc3QoKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGlmICgkKHRoaXMpLmlzKCc6bGFzdC1jaGlsZCcpKSB7IC8vIGlzIGxhc3QgZWxlbWVudCBvZiBzdWIgbWVudVxyXG4gICAgICAgICAgICAkbmV4dEVsZW1lbnQgPSAkZWxlbWVudC5wYXJlbnRzKCdsaScpLmZpcnN0KCkubmV4dCgnbGknKS5maW5kKCdhJykuZmlyc3QoKTtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIEZvdW5kYXRpb24uS2V5Ym9hcmQuaGFuZGxlS2V5KGUsICdBY2NvcmRpb25NZW51Jywge1xyXG4gICAgICAgIG9wZW46IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgaWYgKCR0YXJnZXQuaXMoJzpoaWRkZW4nKSkge1xyXG4gICAgICAgICAgICBfdGhpcy5kb3duKCR0YXJnZXQpO1xyXG4gICAgICAgICAgICAkdGFyZ2V0LmZpbmQoJ2xpJykuZmlyc3QoKS5maW5kKCdhJykuZmlyc3QoKS5mb2N1cygpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgY2xvc2U6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgaWYgKCR0YXJnZXQubGVuZ3RoICYmICEkdGFyZ2V0LmlzKCc6aGlkZGVuJykpIHsgLy8gY2xvc2UgYWN0aXZlIHN1YiBvZiB0aGlzIGl0ZW1cclxuICAgICAgICAgICAgX3RoaXMudXAoJHRhcmdldCk7XHJcbiAgICAgICAgICB9IGVsc2UgaWYgKCRlbGVtZW50LnBhcmVudCgnW2RhdGEtc3VibWVudV0nKS5sZW5ndGgpIHsgLy8gY2xvc2UgY3VycmVudGx5IG9wZW4gc3ViXHJcbiAgICAgICAgICAgIF90aGlzLnVwKCRlbGVtZW50LnBhcmVudCgnW2RhdGEtc3VibWVudV0nKSk7XHJcbiAgICAgICAgICAgICRlbGVtZW50LnBhcmVudHMoJ2xpJykuZmlyc3QoKS5maW5kKCdhJykuZmlyc3QoKS5mb2N1cygpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgdXA6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgJHByZXZFbGVtZW50LmZvY3VzKCk7XHJcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGRvd246IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgJG5leHRFbGVtZW50LmZvY3VzKCk7XHJcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHRvZ2dsZTogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICBpZiAoJGVsZW1lbnQuY2hpbGRyZW4oJ1tkYXRhLXN1Ym1lbnVdJykubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIF90aGlzLnRvZ2dsZSgkZWxlbWVudC5jaGlsZHJlbignW2RhdGEtc3VibWVudV0nKSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICBjbG9zZUFsbDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICBfdGhpcy5oaWRlQWxsKCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBoYW5kbGVkOiBmdW5jdGlvbihwcmV2ZW50RGVmYXVsdCkge1xyXG4gICAgICAgICAgaWYgKHByZXZlbnREZWZhdWx0KSB7XHJcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH0pOy8vLmF0dHIoJ3RhYmluZGV4JywgMCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDbG9zZXMgYWxsIHBhbmVzIG9mIHRoZSBtZW51LlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIGhpZGVBbGwoKSB7XHJcbiAgICB0aGlzLnVwKHRoaXMuJGVsZW1lbnQuZmluZCgnW2RhdGEtc3VibWVudV0nKSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBPcGVucyBhbGwgcGFuZXMgb2YgdGhlIG1lbnUuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgc2hvd0FsbCgpIHtcclxuICAgIHRoaXMuZG93bih0aGlzLiRlbGVtZW50LmZpbmQoJ1tkYXRhLXN1Ym1lbnVdJykpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVG9nZ2xlcyB0aGUgb3Blbi9jbG9zZSBzdGF0ZSBvZiBhIHN1Ym1lbnUuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHBhcmFtIHtqUXVlcnl9ICR0YXJnZXQgLSB0aGUgc3VibWVudSB0byB0b2dnbGVcclxuICAgKi9cclxuICB0b2dnbGUoJHRhcmdldCl7XHJcbiAgICBpZighJHRhcmdldC5pcygnOmFuaW1hdGVkJykpIHtcclxuICAgICAgaWYgKCEkdGFyZ2V0LmlzKCc6aGlkZGVuJykpIHtcclxuICAgICAgICB0aGlzLnVwKCR0YXJnZXQpO1xyXG4gICAgICB9XHJcbiAgICAgIGVsc2Uge1xyXG4gICAgICAgIHRoaXMuZG93bigkdGFyZ2V0KTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogT3BlbnMgdGhlIHN1Yi1tZW51IGRlZmluZWQgYnkgYCR0YXJnZXRgLlxyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSAkdGFyZ2V0IC0gU3ViLW1lbnUgdG8gb3Blbi5cclxuICAgKiBAZmlyZXMgQWNjb3JkaW9uTWVudSNkb3duXHJcbiAgICovXHJcbiAgZG93bigkdGFyZ2V0KSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG5cclxuICAgIGlmKCF0aGlzLm9wdGlvbnMubXVsdGlPcGVuKSB7XHJcbiAgICAgIHRoaXMudXAodGhpcy4kZWxlbWVudC5maW5kKCcuaXMtYWN0aXZlJykubm90KCR0YXJnZXQucGFyZW50c1VudGlsKHRoaXMuJGVsZW1lbnQpLmFkZCgkdGFyZ2V0KSkpO1xyXG4gICAgfVxyXG5cclxuICAgICR0YXJnZXQuYWRkQ2xhc3MoJ2lzLWFjdGl2ZScpLmF0dHIoeydhcmlhLWhpZGRlbic6IGZhbHNlfSlcclxuICAgICAgLnBhcmVudCgnLmlzLWFjY29yZGlvbi1zdWJtZW51LXBhcmVudCcpLmF0dHIoeydhcmlhLWV4cGFuZGVkJzogdHJ1ZX0pO1xyXG5cclxuICAgICAgLy9Gb3VuZGF0aW9uLk1vdmUodGhpcy5vcHRpb25zLnNsaWRlU3BlZWQsICR0YXJnZXQsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICR0YXJnZXQuc2xpZGVEb3duKF90aGlzLm9wdGlvbnMuc2xpZGVTcGVlZCwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgKiBGaXJlcyB3aGVuIHRoZSBtZW51IGlzIGRvbmUgb3BlbmluZy5cclxuICAgICAgICAgICAqIEBldmVudCBBY2NvcmRpb25NZW51I2Rvd25cclxuICAgICAgICAgICAqL1xyXG4gICAgICAgICAgX3RoaXMuJGVsZW1lbnQudHJpZ2dlcignZG93bi56Zi5hY2NvcmRpb25NZW51JywgWyR0YXJnZXRdKTtcclxuICAgICAgICB9KTtcclxuICAgICAgLy99KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENsb3NlcyB0aGUgc3ViLW1lbnUgZGVmaW5lZCBieSBgJHRhcmdldGAuIEFsbCBzdWItbWVudXMgaW5zaWRlIHRoZSB0YXJnZXQgd2lsbCBiZSBjbG9zZWQgYXMgd2VsbC5cclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gJHRhcmdldCAtIFN1Yi1tZW51IHRvIGNsb3NlLlxyXG4gICAqIEBmaXJlcyBBY2NvcmRpb25NZW51I3VwXHJcbiAgICovXHJcbiAgdXAoJHRhcmdldCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgIC8vRm91bmRhdGlvbi5Nb3ZlKHRoaXMub3B0aW9ucy5zbGlkZVNwZWVkLCAkdGFyZ2V0LCBmdW5jdGlvbigpe1xyXG4gICAgICAkdGFyZ2V0LnNsaWRlVXAoX3RoaXMub3B0aW9ucy5zbGlkZVNwZWVkLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogRmlyZXMgd2hlbiB0aGUgbWVudSBpcyBkb25lIGNvbGxhcHNpbmcgdXAuXHJcbiAgICAgICAgICogQGV2ZW50IEFjY29yZGlvbk1lbnUjdXBcclxuICAgICAgICAgKi9cclxuICAgICAgICBfdGhpcy4kZWxlbWVudC50cmlnZ2VyKCd1cC56Zi5hY2NvcmRpb25NZW51JywgWyR0YXJnZXRdKTtcclxuICAgICAgfSk7XHJcbiAgICAvL30pO1xyXG5cclxuICAgIHZhciAkbWVudXMgPSAkdGFyZ2V0LmZpbmQoJ1tkYXRhLXN1Ym1lbnVdJykuc2xpZGVVcCgwKS5hZGRCYWNrKCkuYXR0cignYXJpYS1oaWRkZW4nLCB0cnVlKTtcclxuXHJcbiAgICAkbWVudXMucGFyZW50KCcuaXMtYWNjb3JkaW9uLXN1Ym1lbnUtcGFyZW50JykuYXR0cignYXJpYS1leHBhbmRlZCcsIGZhbHNlKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlc3Ryb3lzIGFuIGluc3RhbmNlIG9mIGFjY29yZGlvbiBtZW51LlxyXG4gICAqIEBmaXJlcyBBY2NvcmRpb25NZW51I2Rlc3Ryb3llZFxyXG4gICAqL1xyXG4gIGRlc3Ryb3koKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50LmZpbmQoJ1tkYXRhLXN1Ym1lbnVdJykuc2xpZGVEb3duKDApLmNzcygnZGlzcGxheScsICcnKTtcclxuICAgIHRoaXMuJGVsZW1lbnQuZmluZCgnYScpLm9mZignY2xpY2suemYuYWNjb3JkaW9uTWVudScpO1xyXG5cclxuICAgIEZvdW5kYXRpb24uTmVzdC5CdXJuKHRoaXMuJGVsZW1lbnQsICdhY2NvcmRpb24nKTtcclxuICAgIEZvdW5kYXRpb24udW5yZWdpc3RlclBsdWdpbih0aGlzKTtcclxuICB9XHJcbn1cclxuXHJcbkFjY29yZGlvbk1lbnUuZGVmYXVsdHMgPSB7XHJcbiAgLyoqXHJcbiAgICogQW1vdW50IG9mIHRpbWUgdG8gYW5pbWF0ZSB0aGUgb3BlbmluZyBvZiBhIHN1Ym1lbnUgaW4gbXMuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDI1MFxyXG4gICAqL1xyXG4gIHNsaWRlU3BlZWQ6IDI1MCxcclxuICAvKipcclxuICAgKiBBbGxvdyB0aGUgbWVudSB0byBoYXZlIG11bHRpcGxlIG9wZW4gcGFuZXMuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIHRydWVcclxuICAgKi9cclxuICBtdWx0aU9wZW46IHRydWVcclxufTtcclxuXHJcbi8vIFdpbmRvdyBleHBvcnRzXHJcbkZvdW5kYXRpb24ucGx1Z2luKEFjY29yZGlvbk1lbnUsICdBY2NvcmRpb25NZW51Jyk7XHJcblxyXG59KGpRdWVyeSk7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbiFmdW5jdGlvbigkKSB7XHJcblxyXG4vKipcclxuICogRHJpbGxkb3duIG1vZHVsZS5cclxuICogQG1vZHVsZSBmb3VuZGF0aW9uLmRyaWxsZG93blxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLmtleWJvYXJkXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwubW90aW9uXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwubmVzdFxyXG4gKi9cclxuXHJcbmNsYXNzIERyaWxsZG93biB7XHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlcyBhIG5ldyBpbnN0YW5jZSBvZiBhIGRyaWxsZG93biBtZW51LlxyXG4gICAqIEBjbGFzc1xyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSBlbGVtZW50IC0galF1ZXJ5IG9iamVjdCB0byBtYWtlIGludG8gYW4gYWNjb3JkaW9uIG1lbnUuXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgLSBPdmVycmlkZXMgdG8gdGhlIGRlZmF1bHQgcGx1Z2luIHNldHRpbmdzLlxyXG4gICAqL1xyXG4gIGNvbnN0cnVjdG9yKGVsZW1lbnQsIG9wdGlvbnMpIHtcclxuICAgIHRoaXMuJGVsZW1lbnQgPSBlbGVtZW50O1xyXG4gICAgdGhpcy5vcHRpb25zID0gJC5leHRlbmQoe30sIERyaWxsZG93bi5kZWZhdWx0cywgdGhpcy4kZWxlbWVudC5kYXRhKCksIG9wdGlvbnMpO1xyXG5cclxuICAgIEZvdW5kYXRpb24uTmVzdC5GZWF0aGVyKHRoaXMuJGVsZW1lbnQsICdkcmlsbGRvd24nKTtcclxuXHJcbiAgICB0aGlzLl9pbml0KCk7XHJcblxyXG4gICAgRm91bmRhdGlvbi5yZWdpc3RlclBsdWdpbih0aGlzLCAnRHJpbGxkb3duJyk7XHJcbiAgICBGb3VuZGF0aW9uLktleWJvYXJkLnJlZ2lzdGVyKCdEcmlsbGRvd24nLCB7XHJcbiAgICAgICdFTlRFUic6ICdvcGVuJyxcclxuICAgICAgJ1NQQUNFJzogJ29wZW4nLFxyXG4gICAgICAnQVJST1dfUklHSFQnOiAnbmV4dCcsXHJcbiAgICAgICdBUlJPV19VUCc6ICd1cCcsXHJcbiAgICAgICdBUlJPV19ET1dOJzogJ2Rvd24nLFxyXG4gICAgICAnQVJST1dfTEVGVCc6ICdwcmV2aW91cycsXHJcbiAgICAgICdFU0NBUEUnOiAnY2xvc2UnLFxyXG4gICAgICAnVEFCJzogJ2Rvd24nLFxyXG4gICAgICAnU0hJRlRfVEFCJzogJ3VwJ1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJbml0aWFsaXplcyB0aGUgZHJpbGxkb3duIGJ5IGNyZWF0aW5nIGpRdWVyeSBjb2xsZWN0aW9ucyBvZiBlbGVtZW50c1xyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2luaXQoKSB7XHJcbiAgICB0aGlzLiRzdWJtZW51QW5jaG9ycyA9IHRoaXMuJGVsZW1lbnQuZmluZCgnbGkuaXMtZHJpbGxkb3duLXN1Ym1lbnUtcGFyZW50JykuY2hpbGRyZW4oJ2EnKTtcclxuICAgIHRoaXMuJHN1Ym1lbnVzID0gdGhpcy4kc3VibWVudUFuY2hvcnMucGFyZW50KCdsaScpLmNoaWxkcmVuKCdbZGF0YS1zdWJtZW51XScpO1xyXG4gICAgdGhpcy4kbWVudUl0ZW1zID0gdGhpcy4kZWxlbWVudC5maW5kKCdsaScpLm5vdCgnLmpzLWRyaWxsZG93bi1iYWNrJykuYXR0cigncm9sZScsICdtZW51aXRlbScpLmZpbmQoJ2EnKTtcclxuICAgIHRoaXMuJGVsZW1lbnQuYXR0cignZGF0YS1tdXRhdGUnLCAodGhpcy4kZWxlbWVudC5hdHRyKCdkYXRhLWRyaWxsZG93bicpIHx8IEZvdW5kYXRpb24uR2V0WW9EaWdpdHMoNiwgJ2RyaWxsZG93bicpKSk7XHJcblxyXG4gICAgdGhpcy5fcHJlcGFyZU1lbnUoKTtcclxuICAgIHRoaXMuX3JlZ2lzdGVyRXZlbnRzKCk7XHJcblxyXG4gICAgdGhpcy5fa2V5Ym9hcmRFdmVudHMoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIHByZXBhcmVzIGRyaWxsZG93biBtZW51IGJ5IHNldHRpbmcgYXR0cmlidXRlcyB0byBsaW5rcyBhbmQgZWxlbWVudHNcclxuICAgKiBzZXRzIGEgbWluIGhlaWdodCB0byBwcmV2ZW50IGNvbnRlbnQganVtcGluZ1xyXG4gICAqIHdyYXBzIHRoZSBlbGVtZW50IGlmIG5vdCBhbHJlYWR5IHdyYXBwZWRcclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIF9wcmVwYXJlTWVudSgpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAvLyBpZighdGhpcy5vcHRpb25zLmhvbGRPcGVuKXtcclxuICAgIC8vICAgdGhpcy5fbWVudUxpbmtFdmVudHMoKTtcclxuICAgIC8vIH1cclxuICAgIHRoaXMuJHN1Ym1lbnVBbmNob3JzLmVhY2goZnVuY3Rpb24oKXtcclxuICAgICAgdmFyICRsaW5rID0gJCh0aGlzKTtcclxuICAgICAgdmFyICRzdWIgPSAkbGluay5wYXJlbnQoKTtcclxuICAgICAgaWYoX3RoaXMub3B0aW9ucy5wYXJlbnRMaW5rKXtcclxuICAgICAgICAkbGluay5jbG9uZSgpLnByZXBlbmRUbygkc3ViLmNoaWxkcmVuKCdbZGF0YS1zdWJtZW51XScpKS53cmFwKCc8bGkgY2xhc3M9XCJpcy1zdWJtZW51LXBhcmVudC1pdGVtIGlzLXN1Ym1lbnUtaXRlbSBpcy1kcmlsbGRvd24tc3VibWVudS1pdGVtXCIgcm9sZT1cIm1lbnUtaXRlbVwiPjwvbGk+Jyk7XHJcbiAgICAgIH1cclxuICAgICAgJGxpbmsuZGF0YSgnc2F2ZWRIcmVmJywgJGxpbmsuYXR0cignaHJlZicpKS5yZW1vdmVBdHRyKCdocmVmJykuYXR0cigndGFiaW5kZXgnLCAwKTtcclxuICAgICAgJGxpbmsuY2hpbGRyZW4oJ1tkYXRhLXN1Ym1lbnVdJylcclxuICAgICAgICAgIC5hdHRyKHtcclxuICAgICAgICAgICAgJ2FyaWEtaGlkZGVuJzogdHJ1ZSxcclxuICAgICAgICAgICAgJ3RhYmluZGV4JzogMCxcclxuICAgICAgICAgICAgJ3JvbGUnOiAnbWVudSdcclxuICAgICAgICAgIH0pO1xyXG4gICAgICBfdGhpcy5fZXZlbnRzKCRsaW5rKTtcclxuICAgIH0pO1xyXG4gICAgdGhpcy4kc3VibWVudXMuZWFjaChmdW5jdGlvbigpe1xyXG4gICAgICB2YXIgJG1lbnUgPSAkKHRoaXMpLFxyXG4gICAgICAgICAgJGJhY2sgPSAkbWVudS5maW5kKCcuanMtZHJpbGxkb3duLWJhY2snKTtcclxuICAgICAgaWYoISRiYWNrLmxlbmd0aCl7XHJcbiAgICAgICAgc3dpdGNoIChfdGhpcy5vcHRpb25zLmJhY2tCdXR0b25Qb3NpdGlvbikge1xyXG4gICAgICAgICAgY2FzZSBcImJvdHRvbVwiOlxyXG4gICAgICAgICAgICAkbWVudS5hcHBlbmQoX3RoaXMub3B0aW9ucy5iYWNrQnV0dG9uKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICBjYXNlIFwidG9wXCI6XHJcbiAgICAgICAgICAgICRtZW51LnByZXBlbmQoX3RoaXMub3B0aW9ucy5iYWNrQnV0dG9uKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiVW5zdXBwb3J0ZWQgYmFja0J1dHRvblBvc2l0aW9uIHZhbHVlICdcIiArIF90aGlzLm9wdGlvbnMuYmFja0J1dHRvblBvc2l0aW9uICsgXCInXCIpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBfdGhpcy5fYmFjaygkbWVudSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBpZighdGhpcy5vcHRpb25zLmF1dG9IZWlnaHQpIHtcclxuICAgICAgdGhpcy4kc3VibWVudXMuYWRkQ2xhc3MoJ2RyaWxsZG93bi1zdWJtZW51LWNvdmVyLXByZXZpb3VzJyk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYoIXRoaXMuJGVsZW1lbnQucGFyZW50KCkuaGFzQ2xhc3MoJ2lzLWRyaWxsZG93bicpKXtcclxuICAgICAgdGhpcy4kd3JhcHBlciA9ICQodGhpcy5vcHRpb25zLndyYXBwZXIpLmFkZENsYXNzKCdpcy1kcmlsbGRvd24nKTtcclxuICAgICAgaWYodGhpcy5vcHRpb25zLmFuaW1hdGVIZWlnaHQpIHRoaXMuJHdyYXBwZXIuYWRkQ2xhc3MoJ2FuaW1hdGUtaGVpZ2h0Jyk7XHJcbiAgICAgIHRoaXMuJHdyYXBwZXIgPSB0aGlzLiRlbGVtZW50LndyYXAodGhpcy4kd3JhcHBlcikucGFyZW50KCkuY3NzKHRoaXMuX2dldE1heERpbXMoKSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBfcmVzaXplKCkge1xyXG4gICAgdGhpcy4kd3JhcHBlci5jc3MoeydtYXgtd2lkdGgnOiAnbm9uZScsICdtaW4taGVpZ2h0JzogJ25vbmUnfSk7XHJcbiAgICAvLyBfZ2V0TWF4RGltcyBoYXMgc2lkZSBlZmZlY3RzIChib28pIGJ1dCBjYWxsaW5nIGl0IHNob3VsZCB1cGRhdGUgYWxsIG90aGVyIG5lY2Vzc2FyeSBoZWlnaHRzICYgd2lkdGhzXHJcbiAgICB0aGlzLiR3cmFwcGVyLmNzcyh0aGlzLl9nZXRNYXhEaW1zKCkpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBldmVudCBoYW5kbGVycyB0byBlbGVtZW50cyBpbiB0aGUgbWVudS5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSAkZWxlbSAtIHRoZSBjdXJyZW50IG1lbnUgaXRlbSB0byBhZGQgaGFuZGxlcnMgdG8uXHJcbiAgICovXHJcbiAgX2V2ZW50cygkZWxlbSkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuXHJcbiAgICAkZWxlbS5vZmYoJ2NsaWNrLnpmLmRyaWxsZG93bicpXHJcbiAgICAub24oJ2NsaWNrLnpmLmRyaWxsZG93bicsIGZ1bmN0aW9uKGUpe1xyXG4gICAgICBpZigkKGUudGFyZ2V0KS5wYXJlbnRzVW50aWwoJ3VsJywgJ2xpJykuaGFzQ2xhc3MoJ2lzLWRyaWxsZG93bi1zdWJtZW51LXBhcmVudCcpKXtcclxuICAgICAgICBlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gaWYoZS50YXJnZXQgIT09IGUuY3VycmVudFRhcmdldC5maXJzdEVsZW1lbnRDaGlsZCl7XHJcbiAgICAgIC8vICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAvLyB9XHJcbiAgICAgIF90aGlzLl9zaG93KCRlbGVtLnBhcmVudCgnbGknKSk7XHJcblxyXG4gICAgICBpZihfdGhpcy5vcHRpb25zLmNsb3NlT25DbGljayl7XHJcbiAgICAgICAgdmFyICRib2R5ID0gJCgnYm9keScpO1xyXG4gICAgICAgICRib2R5Lm9mZignLnpmLmRyaWxsZG93bicpLm9uKCdjbGljay56Zi5kcmlsbGRvd24nLCBmdW5jdGlvbihlKXtcclxuICAgICAgICAgIGlmIChlLnRhcmdldCA9PT0gX3RoaXMuJGVsZW1lbnRbMF0gfHwgJC5jb250YWlucyhfdGhpcy4kZWxlbWVudFswXSwgZS50YXJnZXQpKSB7IHJldHVybjsgfVxyXG4gICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgX3RoaXMuX2hpZGVBbGwoKTtcclxuICAgICAgICAgICRib2R5Lm9mZignLnpmLmRyaWxsZG93bicpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHQgIHRoaXMuJGVsZW1lbnQub24oJ211dGF0ZW1lLnpmLnRyaWdnZXInLCB0aGlzLl9yZXNpemUuYmluZCh0aGlzKSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGRzIGV2ZW50IGhhbmRsZXJzIHRvIHRoZSBtZW51IGVsZW1lbnQuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfcmVnaXN0ZXJFdmVudHMoKSB7XHJcbiAgICBpZih0aGlzLm9wdGlvbnMuc2Nyb2xsVG9wKXtcclxuICAgICAgdGhpcy5fYmluZEhhbmRsZXIgPSB0aGlzLl9zY3JvbGxUb3AuYmluZCh0aGlzKTtcclxuICAgICAgdGhpcy4kZWxlbWVudC5vbignb3Blbi56Zi5kcmlsbGRvd24gaGlkZS56Zi5kcmlsbGRvd24gY2xvc2VkLnpmLmRyaWxsZG93bicsdGhpcy5fYmluZEhhbmRsZXIpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2Nyb2xsIHRvIFRvcCBvZiBFbGVtZW50IG9yIGRhdGEtc2Nyb2xsLXRvcC1lbGVtZW50XHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQGZpcmVzIERyaWxsZG93biNzY3JvbGxtZVxyXG4gICAqL1xyXG4gIF9zY3JvbGxUb3AoKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgdmFyICRzY3JvbGxUb3BFbGVtZW50ID0gX3RoaXMub3B0aW9ucy5zY3JvbGxUb3BFbGVtZW50IT0nJz8kKF90aGlzLm9wdGlvbnMuc2Nyb2xsVG9wRWxlbWVudCk6X3RoaXMuJGVsZW1lbnQsXHJcbiAgICAgICAgc2Nyb2xsUG9zID0gcGFyc2VJbnQoJHNjcm9sbFRvcEVsZW1lbnQub2Zmc2V0KCkudG9wK190aGlzLm9wdGlvbnMuc2Nyb2xsVG9wT2Zmc2V0KTtcclxuICAgICQoJ2h0bWwsIGJvZHknKS5zdG9wKHRydWUpLmFuaW1hdGUoeyBzY3JvbGxUb3A6IHNjcm9sbFBvcyB9LCBfdGhpcy5vcHRpb25zLmFuaW1hdGlvbkR1cmF0aW9uLCBfdGhpcy5vcHRpb25zLmFuaW1hdGlvbkVhc2luZyxmdW5jdGlvbigpe1xyXG4gICAgICAvKipcclxuICAgICAgICAqIEZpcmVzIGFmdGVyIHRoZSBtZW51IGhhcyBzY3JvbGxlZFxyXG4gICAgICAgICogQGV2ZW50IERyaWxsZG93biNzY3JvbGxtZVxyXG4gICAgICAgICovXHJcbiAgICAgIGlmKHRoaXM9PT0kKCdodG1sJylbMF0pX3RoaXMuJGVsZW1lbnQudHJpZ2dlcignc2Nyb2xsbWUuemYuZHJpbGxkb3duJyk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMga2V5ZG93biBldmVudCBsaXN0ZW5lciB0byBgbGlgJ3MgaW4gdGhlIG1lbnUuXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfa2V5Ym9hcmRFdmVudHMoKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG5cclxuICAgIHRoaXMuJG1lbnVJdGVtcy5hZGQodGhpcy4kZWxlbWVudC5maW5kKCcuanMtZHJpbGxkb3duLWJhY2sgPiBhLCAuaXMtc3VibWVudS1wYXJlbnQtaXRlbSA+IGEnKSkub24oJ2tleWRvd24uemYuZHJpbGxkb3duJywgZnVuY3Rpb24oZSl7XHJcbiAgICAgIHZhciAkZWxlbWVudCA9ICQodGhpcyksXHJcbiAgICAgICAgICAkZWxlbWVudHMgPSAkZWxlbWVudC5wYXJlbnQoJ2xpJykucGFyZW50KCd1bCcpLmNoaWxkcmVuKCdsaScpLmNoaWxkcmVuKCdhJyksXHJcbiAgICAgICAgICAkcHJldkVsZW1lbnQsXHJcbiAgICAgICAgICAkbmV4dEVsZW1lbnQ7XHJcblxyXG4gICAgICAkZWxlbWVudHMuZWFjaChmdW5jdGlvbihpKSB7XHJcbiAgICAgICAgaWYgKCQodGhpcykuaXMoJGVsZW1lbnQpKSB7XHJcbiAgICAgICAgICAkcHJldkVsZW1lbnQgPSAkZWxlbWVudHMuZXEoTWF0aC5tYXgoMCwgaS0xKSk7XHJcbiAgICAgICAgICAkbmV4dEVsZW1lbnQgPSAkZWxlbWVudHMuZXEoTWF0aC5taW4oaSsxLCAkZWxlbWVudHMubGVuZ3RoLTEpKTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgRm91bmRhdGlvbi5LZXlib2FyZC5oYW5kbGVLZXkoZSwgJ0RyaWxsZG93bicsIHtcclxuICAgICAgICBuZXh0OiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgIGlmICgkZWxlbWVudC5pcyhfdGhpcy4kc3VibWVudUFuY2hvcnMpKSB7XHJcbiAgICAgICAgICAgIF90aGlzLl9zaG93KCRlbGVtZW50LnBhcmVudCgnbGknKSk7XHJcbiAgICAgICAgICAgICRlbGVtZW50LnBhcmVudCgnbGknKS5vbmUoRm91bmRhdGlvbi50cmFuc2l0aW9uZW5kKCRlbGVtZW50KSwgZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgICAkZWxlbWVudC5wYXJlbnQoJ2xpJykuZmluZCgndWwgbGkgYScpLmZpbHRlcihfdGhpcy4kbWVudUl0ZW1zKS5maXJzdCgpLmZvY3VzKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIHByZXZpb3VzOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgIF90aGlzLl9oaWRlKCRlbGVtZW50LnBhcmVudCgnbGknKS5wYXJlbnQoJ3VsJykpO1xyXG4gICAgICAgICAgJGVsZW1lbnQucGFyZW50KCdsaScpLnBhcmVudCgndWwnKS5vbmUoRm91bmRhdGlvbi50cmFuc2l0aW9uZW5kKCRlbGVtZW50KSwgZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAkZWxlbWVudC5wYXJlbnQoJ2xpJykucGFyZW50KCd1bCcpLnBhcmVudCgnbGknKS5jaGlsZHJlbignYScpLmZpcnN0KCkuZm9jdXMoKTtcclxuICAgICAgICAgICAgfSwgMSk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgdXA6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgJHByZXZFbGVtZW50LmZvY3VzKCk7XHJcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGRvd246IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgJG5leHRFbGVtZW50LmZvY3VzKCk7XHJcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGNsb3NlOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgIF90aGlzLl9iYWNrKCk7XHJcbiAgICAgICAgICAvL190aGlzLiRtZW51SXRlbXMuZmlyc3QoKS5mb2N1cygpOyAvLyBmb2N1cyB0byBmaXJzdCBlbGVtZW50XHJcbiAgICAgICAgfSxcclxuICAgICAgICBvcGVuOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgIGlmICghJGVsZW1lbnQuaXMoX3RoaXMuJG1lbnVJdGVtcykpIHsgLy8gbm90IG1lbnUgaXRlbSBtZWFucyBiYWNrIGJ1dHRvblxyXG4gICAgICAgICAgICBfdGhpcy5faGlkZSgkZWxlbWVudC5wYXJlbnQoJ2xpJykucGFyZW50KCd1bCcpKTtcclxuICAgICAgICAgICAgJGVsZW1lbnQucGFyZW50KCdsaScpLnBhcmVudCgndWwnKS5vbmUoRm91bmRhdGlvbi50cmFuc2l0aW9uZW5kKCRlbGVtZW50KSwgZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgJGVsZW1lbnQucGFyZW50KCdsaScpLnBhcmVudCgndWwnKS5wYXJlbnQoJ2xpJykuY2hpbGRyZW4oJ2EnKS5maXJzdCgpLmZvY3VzKCk7XHJcbiAgICAgICAgICAgICAgfSwgMSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgIH0gZWxzZSBpZiAoJGVsZW1lbnQuaXMoX3RoaXMuJHN1Ym1lbnVBbmNob3JzKSkge1xyXG4gICAgICAgICAgICBfdGhpcy5fc2hvdygkZWxlbWVudC5wYXJlbnQoJ2xpJykpO1xyXG4gICAgICAgICAgICAkZWxlbWVudC5wYXJlbnQoJ2xpJykub25lKEZvdW5kYXRpb24udHJhbnNpdGlvbmVuZCgkZWxlbWVudCksIGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgICAgJGVsZW1lbnQucGFyZW50KCdsaScpLmZpbmQoJ3VsIGxpIGEnKS5maWx0ZXIoX3RoaXMuJG1lbnVJdGVtcykuZmlyc3QoKS5mb2N1cygpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICBoYW5kbGVkOiBmdW5jdGlvbihwcmV2ZW50RGVmYXVsdCkge1xyXG4gICAgICAgICAgaWYgKHByZXZlbnREZWZhdWx0KSB7XHJcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH0pOyAvLyBlbmQga2V5Ym9hcmRBY2Nlc3NcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENsb3NlcyBhbGwgb3BlbiBlbGVtZW50cywgYW5kIHJldHVybnMgdG8gcm9vdCBtZW51LlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBmaXJlcyBEcmlsbGRvd24jY2xvc2VkXHJcbiAgICovXHJcbiAgX2hpZGVBbGwoKSB7XHJcbiAgICB2YXIgJGVsZW0gPSB0aGlzLiRlbGVtZW50LmZpbmQoJy5pcy1kcmlsbGRvd24tc3VibWVudS5pcy1hY3RpdmUnKS5hZGRDbGFzcygnaXMtY2xvc2luZycpO1xyXG4gICAgaWYodGhpcy5vcHRpb25zLmF1dG9IZWlnaHQpIHRoaXMuJHdyYXBwZXIuY3NzKHtoZWlnaHQ6JGVsZW0ucGFyZW50KCkuY2xvc2VzdCgndWwnKS5kYXRhKCdjYWxjSGVpZ2h0Jyl9KTtcclxuICAgICRlbGVtLm9uZShGb3VuZGF0aW9uLnRyYW5zaXRpb25lbmQoJGVsZW0pLCBmdW5jdGlvbihlKXtcclxuICAgICAgJGVsZW0ucmVtb3ZlQ2xhc3MoJ2lzLWFjdGl2ZSBpcy1jbG9zaW5nJyk7XHJcbiAgICB9KTtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBGaXJlcyB3aGVuIHRoZSBtZW51IGlzIGZ1bGx5IGNsb3NlZC5cclxuICAgICAgICAgKiBAZXZlbnQgRHJpbGxkb3duI2Nsb3NlZFxyXG4gICAgICAgICAqL1xyXG4gICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdjbG9zZWQuemYuZHJpbGxkb3duJyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGRzIGV2ZW50IGxpc3RlbmVyIGZvciBlYWNoIGBiYWNrYCBidXR0b24sIGFuZCBjbG9zZXMgb3BlbiBtZW51cy5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAZmlyZXMgRHJpbGxkb3duI2JhY2tcclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gJGVsZW0gLSB0aGUgY3VycmVudCBzdWItbWVudSB0byBhZGQgYGJhY2tgIGV2ZW50LlxyXG4gICAqL1xyXG4gIF9iYWNrKCRlbGVtKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgJGVsZW0ub2ZmKCdjbGljay56Zi5kcmlsbGRvd24nKTtcclxuICAgICRlbGVtLmNoaWxkcmVuKCcuanMtZHJpbGxkb3duLWJhY2snKVxyXG4gICAgICAub24oJ2NsaWNrLnpmLmRyaWxsZG93bicsIGZ1bmN0aW9uKGUpe1xyXG4gICAgICAgIGUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XHJcbiAgICAgICAgLy8gY29uc29sZS5sb2coJ21vdXNldXAgb24gYmFjaycpO1xyXG4gICAgICAgIF90aGlzLl9oaWRlKCRlbGVtKTtcclxuXHJcbiAgICAgICAgLy8gSWYgdGhlcmUgaXMgYSBwYXJlbnQgc3VibWVudSwgY2FsbCBzaG93XHJcbiAgICAgICAgbGV0IHBhcmVudFN1Yk1lbnUgPSAkZWxlbS5wYXJlbnQoJ2xpJykucGFyZW50KCd1bCcpLnBhcmVudCgnbGknKTtcclxuICAgICAgICBpZiAocGFyZW50U3ViTWVudS5sZW5ndGgpIHtcclxuICAgICAgICAgIF90aGlzLl9zaG93KHBhcmVudFN1Yk1lbnUpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGRzIGV2ZW50IGxpc3RlbmVyIHRvIG1lbnUgaXRlbXMgdy9vIHN1Ym1lbnVzIHRvIGNsb3NlIG9wZW4gbWVudXMgb24gY2xpY2suXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfbWVudUxpbmtFdmVudHMoKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgdGhpcy4kbWVudUl0ZW1zLm5vdCgnLmlzLWRyaWxsZG93bi1zdWJtZW51LXBhcmVudCcpXHJcbiAgICAgICAgLm9mZignY2xpY2suemYuZHJpbGxkb3duJylcclxuICAgICAgICAub24oJ2NsaWNrLnpmLmRyaWxsZG93bicsIGZ1bmN0aW9uKGUpe1xyXG4gICAgICAgICAgLy8gZS5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcclxuICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgX3RoaXMuX2hpZGVBbGwoKTtcclxuICAgICAgICAgIH0sIDApO1xyXG4gICAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIE9wZW5zIGEgc3VibWVudS5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAZmlyZXMgRHJpbGxkb3duI29wZW5cclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gJGVsZW0gLSB0aGUgY3VycmVudCBlbGVtZW50IHdpdGggYSBzdWJtZW51IHRvIG9wZW4sIGkuZS4gdGhlIGBsaWAgdGFnLlxyXG4gICAqL1xyXG4gIF9zaG93KCRlbGVtKSB7XHJcbiAgICBpZih0aGlzLm9wdGlvbnMuYXV0b0hlaWdodCkgdGhpcy4kd3JhcHBlci5jc3Moe2hlaWdodDokZWxlbS5jaGlsZHJlbignW2RhdGEtc3VibWVudV0nKS5kYXRhKCdjYWxjSGVpZ2h0Jyl9KTtcclxuICAgICRlbGVtLmF0dHIoJ2FyaWEtZXhwYW5kZWQnLCB0cnVlKTtcclxuICAgICRlbGVtLmNoaWxkcmVuKCdbZGF0YS1zdWJtZW51XScpLmFkZENsYXNzKCdpcy1hY3RpdmUnKS5hdHRyKCdhcmlhLWhpZGRlbicsIGZhbHNlKTtcclxuICAgIC8qKlxyXG4gICAgICogRmlyZXMgd2hlbiB0aGUgc3VibWVudSBoYXMgb3BlbmVkLlxyXG4gICAgICogQGV2ZW50IERyaWxsZG93biNvcGVuXHJcbiAgICAgKi9cclxuICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcignb3Blbi56Zi5kcmlsbGRvd24nLCBbJGVsZW1dKTtcclxuICB9O1xyXG5cclxuICAvKipcclxuICAgKiBIaWRlcyBhIHN1Ym1lbnVcclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAZmlyZXMgRHJpbGxkb3duI2hpZGVcclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gJGVsZW0gLSB0aGUgY3VycmVudCBzdWItbWVudSB0byBoaWRlLCBpLmUuIHRoZSBgdWxgIHRhZy5cclxuICAgKi9cclxuICBfaGlkZSgkZWxlbSkge1xyXG4gICAgaWYodGhpcy5vcHRpb25zLmF1dG9IZWlnaHQpIHRoaXMuJHdyYXBwZXIuY3NzKHtoZWlnaHQ6JGVsZW0ucGFyZW50KCkuY2xvc2VzdCgndWwnKS5kYXRhKCdjYWxjSGVpZ2h0Jyl9KTtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICAkZWxlbS5wYXJlbnQoJ2xpJykuYXR0cignYXJpYS1leHBhbmRlZCcsIGZhbHNlKTtcclxuICAgICRlbGVtLmF0dHIoJ2FyaWEtaGlkZGVuJywgdHJ1ZSkuYWRkQ2xhc3MoJ2lzLWNsb3NpbmcnKVxyXG4gICAgJGVsZW0uYWRkQ2xhc3MoJ2lzLWNsb3NpbmcnKVxyXG4gICAgICAgICAub25lKEZvdW5kYXRpb24udHJhbnNpdGlvbmVuZCgkZWxlbSksIGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgJGVsZW0ucmVtb3ZlQ2xhc3MoJ2lzLWFjdGl2ZSBpcy1jbG9zaW5nJyk7XHJcbiAgICAgICAgICAgJGVsZW0uYmx1cigpO1xyXG4gICAgICAgICB9KTtcclxuICAgIC8qKlxyXG4gICAgICogRmlyZXMgd2hlbiB0aGUgc3VibWVudSBoYXMgY2xvc2VkLlxyXG4gICAgICogQGV2ZW50IERyaWxsZG93biNoaWRlXHJcbiAgICAgKi9cclxuICAgICRlbGVtLnRyaWdnZXIoJ2hpZGUuemYuZHJpbGxkb3duJywgWyRlbGVtXSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJdGVyYXRlcyB0aHJvdWdoIHRoZSBuZXN0ZWQgbWVudXMgdG8gY2FsY3VsYXRlIHRoZSBtaW4taGVpZ2h0LCBhbmQgbWF4LXdpZHRoIGZvciB0aGUgbWVudS5cclxuICAgKiBQcmV2ZW50cyBjb250ZW50IGp1bXBpbmcuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfZ2V0TWF4RGltcygpIHtcclxuICAgIHZhciAgbWF4SGVpZ2h0ID0gMCwgcmVzdWx0ID0ge30sIF90aGlzID0gdGhpcztcclxuICAgIHRoaXMuJHN1Ym1lbnVzLmFkZCh0aGlzLiRlbGVtZW50KS5lYWNoKGZ1bmN0aW9uKCl7XHJcbiAgICAgIHZhciBudW1PZkVsZW1zID0gJCh0aGlzKS5jaGlsZHJlbignbGknKS5sZW5ndGg7XHJcbiAgICAgIHZhciBoZWlnaHQgPSBGb3VuZGF0aW9uLkJveC5HZXREaW1lbnNpb25zKHRoaXMpLmhlaWdodDtcclxuICAgICAgbWF4SGVpZ2h0ID0gaGVpZ2h0ID4gbWF4SGVpZ2h0ID8gaGVpZ2h0IDogbWF4SGVpZ2h0O1xyXG4gICAgICBpZihfdGhpcy5vcHRpb25zLmF1dG9IZWlnaHQpIHtcclxuICAgICAgICAkKHRoaXMpLmRhdGEoJ2NhbGNIZWlnaHQnLGhlaWdodCk7XHJcbiAgICAgICAgaWYgKCEkKHRoaXMpLmhhc0NsYXNzKCdpcy1kcmlsbGRvd24tc3VibWVudScpKSByZXN1bHRbJ2hlaWdodCddID0gaGVpZ2h0O1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICBpZighdGhpcy5vcHRpb25zLmF1dG9IZWlnaHQpIHJlc3VsdFsnbWluLWhlaWdodCddID0gYCR7bWF4SGVpZ2h0fXB4YDtcclxuXHJcbiAgICByZXN1bHRbJ21heC13aWR0aCddID0gYCR7dGhpcy4kZWxlbWVudFswXS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS53aWR0aH1weGA7XHJcblxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlc3Ryb3lzIHRoZSBEcmlsbGRvd24gTWVudVxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIGRlc3Ryb3koKSB7XHJcbiAgICBpZih0aGlzLm9wdGlvbnMuc2Nyb2xsVG9wKSB0aGlzLiRlbGVtZW50Lm9mZignLnpmLmRyaWxsZG93bicsdGhpcy5fYmluZEhhbmRsZXIpO1xyXG4gICAgdGhpcy5faGlkZUFsbCgpO1xyXG5cdCAgdGhpcy4kZWxlbWVudC5vZmYoJ211dGF0ZW1lLnpmLnRyaWdnZXInKTtcclxuICAgIEZvdW5kYXRpb24uTmVzdC5CdXJuKHRoaXMuJGVsZW1lbnQsICdkcmlsbGRvd24nKTtcclxuICAgIHRoaXMuJGVsZW1lbnQudW53cmFwKClcclxuICAgICAgICAgICAgICAgICAuZmluZCgnLmpzLWRyaWxsZG93bi1iYWNrLCAuaXMtc3VibWVudS1wYXJlbnQtaXRlbScpLnJlbW92ZSgpXHJcbiAgICAgICAgICAgICAgICAgLmVuZCgpLmZpbmQoJy5pcy1hY3RpdmUsIC5pcy1jbG9zaW5nLCAuaXMtZHJpbGxkb3duLXN1Ym1lbnUnKS5yZW1vdmVDbGFzcygnaXMtYWN0aXZlIGlzLWNsb3NpbmcgaXMtZHJpbGxkb3duLXN1Ym1lbnUnKVxyXG4gICAgICAgICAgICAgICAgIC5lbmQoKS5maW5kKCdbZGF0YS1zdWJtZW51XScpLnJlbW92ZUF0dHIoJ2FyaWEtaGlkZGVuIHRhYmluZGV4IHJvbGUnKTtcclxuICAgIHRoaXMuJHN1Ym1lbnVBbmNob3JzLmVhY2goZnVuY3Rpb24oKSB7XHJcbiAgICAgICQodGhpcykub2ZmKCcuemYuZHJpbGxkb3duJyk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLiRzdWJtZW51cy5yZW1vdmVDbGFzcygnZHJpbGxkb3duLXN1Ym1lbnUtY292ZXItcHJldmlvdXMnKTtcclxuXHJcbiAgICB0aGlzLiRlbGVtZW50LmZpbmQoJ2EnKS5lYWNoKGZ1bmN0aW9uKCl7XHJcbiAgICAgIHZhciAkbGluayA9ICQodGhpcyk7XHJcbiAgICAgICRsaW5rLnJlbW92ZUF0dHIoJ3RhYmluZGV4Jyk7XHJcbiAgICAgIGlmKCRsaW5rLmRhdGEoJ3NhdmVkSHJlZicpKXtcclxuICAgICAgICAkbGluay5hdHRyKCdocmVmJywgJGxpbmsuZGF0YSgnc2F2ZWRIcmVmJykpLnJlbW92ZURhdGEoJ3NhdmVkSHJlZicpO1xyXG4gICAgICB9ZWxzZXsgcmV0dXJuOyB9XHJcbiAgICB9KTtcclxuICAgIEZvdW5kYXRpb24udW5yZWdpc3RlclBsdWdpbih0aGlzKTtcclxuICB9O1xyXG59XHJcblxyXG5EcmlsbGRvd24uZGVmYXVsdHMgPSB7XHJcbiAgLyoqXHJcbiAgICogTWFya3VwIHVzZWQgZm9yIEpTIGdlbmVyYXRlZCBiYWNrIGJ1dHRvbi4gUHJlcGVuZGVkICBvciBhcHBlbmRlZCAoc2VlIGJhY2tCdXR0b25Qb3NpdGlvbikgdG8gc3VibWVudSBsaXN0cyBhbmQgZGVsZXRlZCBvbiBgZGVzdHJveWAgbWV0aG9kLCAnanMtZHJpbGxkb3duLWJhY2snIGNsYXNzIHJlcXVpcmVkLiBSZW1vdmUgdGhlIGJhY2tzbGFzaCAoYFxcYCkgaWYgY29weSBhbmQgcGFzdGluZy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJzxcXGxpPjxcXGE+QmFjazxcXC9hPjxcXC9saT4nXHJcbiAgICovXHJcbiAgYmFja0J1dHRvbjogJzxsaSBjbGFzcz1cImpzLWRyaWxsZG93bi1iYWNrXCI+PGEgdGFiaW5kZXg9XCIwXCI+QmFjazwvYT48L2xpPicsXHJcbiAgLyoqXHJcbiAgICogUG9zaXRpb24gdGhlIGJhY2sgYnV0dG9uIGVpdGhlciBhdCB0aGUgdG9wIG9yIGJvdHRvbSBvZiBkcmlsbGRvd24gc3VibWVudXMuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGJvdHRvbVxyXG4gICAqL1xyXG4gIGJhY2tCdXR0b25Qb3NpdGlvbjogJ3RvcCcsXHJcbiAgLyoqXHJcbiAgICogTWFya3VwIHVzZWQgdG8gd3JhcCBkcmlsbGRvd24gbWVudS4gVXNlIGEgY2xhc3MgbmFtZSBmb3IgaW5kZXBlbmRlbnQgc3R5bGluZzsgdGhlIEpTIGFwcGxpZWQgY2xhc3M6IGBpcy1kcmlsbGRvd25gIGlzIHJlcXVpcmVkLiBSZW1vdmUgdGhlIGJhY2tzbGFzaCAoYFxcYCkgaWYgY29weSBhbmQgcGFzdGluZy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJzxcXGRpdiBjbGFzcz1cImlzLWRyaWxsZG93blwiPjxcXC9kaXY+J1xyXG4gICAqL1xyXG4gIHdyYXBwZXI6ICc8ZGl2PjwvZGl2PicsXHJcbiAgLyoqXHJcbiAgICogQWRkcyB0aGUgcGFyZW50IGxpbmsgdG8gdGhlIHN1Ym1lbnUuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgcGFyZW50TGluazogZmFsc2UsXHJcbiAgLyoqXHJcbiAgICogQWxsb3cgdGhlIG1lbnUgdG8gcmV0dXJuIHRvIHJvb3QgbGlzdCBvbiBib2R5IGNsaWNrLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIGNsb3NlT25DbGljazogZmFsc2UsXHJcbiAgLyoqXHJcbiAgICogQWxsb3cgdGhlIG1lbnUgdG8gYXV0byBhZGp1c3QgaGVpZ2h0LlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIGF1dG9IZWlnaHQ6IGZhbHNlLFxyXG4gIC8qKlxyXG4gICAqIEFuaW1hdGUgdGhlIGF1dG8gYWRqdXN0IGhlaWdodC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBhbmltYXRlSGVpZ2h0OiBmYWxzZSxcclxuICAvKipcclxuICAgKiBTY3JvbGwgdG8gdGhlIHRvcCBvZiB0aGUgbWVudSBhZnRlciBvcGVuaW5nIGEgc3VibWVudSBvciBuYXZpZ2F0aW5nIGJhY2sgdXNpbmcgdGhlIG1lbnUgYmFjayBidXR0b25cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBzY3JvbGxUb3A6IGZhbHNlLFxyXG4gIC8qKlxyXG4gICAqIFN0cmluZyBqcXVlcnkgc2VsZWN0b3IgKGZvciBleGFtcGxlICdib2R5Jykgb2YgZWxlbWVudCB0byB0YWtlIG9mZnNldCgpLnRvcCBmcm9tLCBpZiBlbXB0eSBzdHJpbmcgdGhlIGRyaWxsZG93biBtZW51IG9mZnNldCgpLnRvcCBpcyB0YWtlblxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnJ1xyXG4gICAqL1xyXG4gIHNjcm9sbFRvcEVsZW1lbnQ6ICcnLFxyXG4gIC8qKlxyXG4gICAqIFNjcm9sbFRvcCBvZmZzZXRcclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgMTAwXHJcbiAgICovXHJcbiAgc2Nyb2xsVG9wT2Zmc2V0OiAwLFxyXG4gIC8qKlxyXG4gICAqIFNjcm9sbCBhbmltYXRpb24gZHVyYXRpb25cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgNTAwXHJcbiAgICovXHJcbiAgYW5pbWF0aW9uRHVyYXRpb246IDUwMCxcclxuICAvKipcclxuICAgKiBTY3JvbGwgYW5pbWF0aW9uIGVhc2luZ1xyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnc3dpbmcnXHJcbiAgICovXHJcbiAgYW5pbWF0aW9uRWFzaW5nOiAnc3dpbmcnXHJcbiAgLy8gaG9sZE9wZW46IGZhbHNlXHJcbn07XHJcblxyXG4vLyBXaW5kb3cgZXhwb3J0c1xyXG5Gb3VuZGF0aW9uLnBsdWdpbihEcmlsbGRvd24sICdEcmlsbGRvd24nKTtcclxuXHJcbn0oalF1ZXJ5KTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuIWZ1bmN0aW9uKCQpIHtcclxuXHJcbi8qKlxyXG4gKiBEcm9wZG93biBtb2R1bGUuXHJcbiAqIEBtb2R1bGUgZm91bmRhdGlvbi5kcm9wZG93blxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLmtleWJvYXJkXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwuYm94XHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwudHJpZ2dlcnNcclxuICovXHJcblxyXG5jbGFzcyBEcm9wZG93biB7XHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlcyBhIG5ldyBpbnN0YW5jZSBvZiBhIGRyb3Bkb3duLlxyXG4gICAqIEBjbGFzc1xyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSBlbGVtZW50IC0galF1ZXJ5IG9iamVjdCB0byBtYWtlIGludG8gYSBkcm9wZG93bi5cclxuICAgKiAgICAgICAgT2JqZWN0IHNob3VsZCBiZSBvZiB0aGUgZHJvcGRvd24gcGFuZWwsIHJhdGhlciB0aGFuIGl0cyBhbmNob3IuXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgLSBPdmVycmlkZXMgdG8gdGhlIGRlZmF1bHQgcGx1Z2luIHNldHRpbmdzLlxyXG4gICAqL1xyXG4gIGNvbnN0cnVjdG9yKGVsZW1lbnQsIG9wdGlvbnMpIHtcclxuICAgIHRoaXMuJGVsZW1lbnQgPSBlbGVtZW50O1xyXG4gICAgdGhpcy5vcHRpb25zID0gJC5leHRlbmQoe30sIERyb3Bkb3duLmRlZmF1bHRzLCB0aGlzLiRlbGVtZW50LmRhdGEoKSwgb3B0aW9ucyk7XHJcbiAgICB0aGlzLl9pbml0KCk7XHJcblxyXG4gICAgRm91bmRhdGlvbi5yZWdpc3RlclBsdWdpbih0aGlzLCAnRHJvcGRvd24nKTtcclxuICAgIEZvdW5kYXRpb24uS2V5Ym9hcmQucmVnaXN0ZXIoJ0Ryb3Bkb3duJywge1xyXG4gICAgICAnRU5URVInOiAnb3BlbicsXHJcbiAgICAgICdTUEFDRSc6ICdvcGVuJyxcclxuICAgICAgJ0VTQ0FQRSc6ICdjbG9zZSdcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbGl6ZXMgdGhlIHBsdWdpbiBieSBzZXR0aW5nL2NoZWNraW5nIG9wdGlvbnMgYW5kIGF0dHJpYnV0ZXMsIGFkZGluZyBoZWxwZXIgdmFyaWFibGVzLCBhbmQgc2F2aW5nIHRoZSBhbmNob3IuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfaW5pdCgpIHtcclxuICAgIHZhciAkaWQgPSB0aGlzLiRlbGVtZW50LmF0dHIoJ2lkJyk7XHJcblxyXG4gICAgdGhpcy4kYW5jaG9yID0gJChgW2RhdGEtdG9nZ2xlPVwiJHskaWR9XCJdYCkubGVuZ3RoID8gJChgW2RhdGEtdG9nZ2xlPVwiJHskaWR9XCJdYCkgOiAkKGBbZGF0YS1vcGVuPVwiJHskaWR9XCJdYCk7XHJcbiAgICB0aGlzLiRhbmNob3IuYXR0cih7XHJcbiAgICAgICdhcmlhLWNvbnRyb2xzJzogJGlkLFxyXG4gICAgICAnZGF0YS1pcy1mb2N1cyc6IGZhbHNlLFxyXG4gICAgICAnZGF0YS15ZXRpLWJveCc6ICRpZCxcclxuICAgICAgJ2FyaWEtaGFzcG9wdXAnOiB0cnVlLFxyXG4gICAgICAnYXJpYS1leHBhbmRlZCc6IGZhbHNlXHJcblxyXG4gICAgfSk7XHJcblxyXG4gICAgaWYodGhpcy5vcHRpb25zLnBhcmVudENsYXNzKXtcclxuICAgICAgdGhpcy4kcGFyZW50ID0gdGhpcy4kZWxlbWVudC5wYXJlbnRzKCcuJyArIHRoaXMub3B0aW9ucy5wYXJlbnRDbGFzcyk7XHJcbiAgICB9ZWxzZXtcclxuICAgICAgdGhpcy4kcGFyZW50ID0gbnVsbDtcclxuICAgIH1cclxuICAgIHRoaXMub3B0aW9ucy5wb3NpdGlvbkNsYXNzID0gdGhpcy5nZXRQb3NpdGlvbkNsYXNzKCk7XHJcbiAgICB0aGlzLmNvdW50ZXIgPSA0O1xyXG4gICAgdGhpcy51c2VkUG9zaXRpb25zID0gW107XHJcbiAgICB0aGlzLiRlbGVtZW50LmF0dHIoe1xyXG4gICAgICAnYXJpYS1oaWRkZW4nOiAndHJ1ZScsXHJcbiAgICAgICdkYXRhLXlldGktYm94JzogJGlkLFxyXG4gICAgICAnZGF0YS1yZXNpemUnOiAkaWQsXHJcbiAgICAgICdhcmlhLWxhYmVsbGVkYnknOiB0aGlzLiRhbmNob3JbMF0uaWQgfHwgRm91bmRhdGlvbi5HZXRZb0RpZ2l0cyg2LCAnZGQtYW5jaG9yJylcclxuICAgIH0pO1xyXG4gICAgdGhpcy5fZXZlbnRzKCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIZWxwZXIgZnVuY3Rpb24gdG8gZGV0ZXJtaW5lIGN1cnJlbnQgb3JpZW50YXRpb24gb2YgZHJvcGRvd24gcGFuZS5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcmV0dXJucyB7U3RyaW5nfSBwb3NpdGlvbiAtIHN0cmluZyB2YWx1ZSBvZiBhIHBvc2l0aW9uIGNsYXNzLlxyXG4gICAqL1xyXG4gIGdldFBvc2l0aW9uQ2xhc3MoKSB7XHJcbiAgICB2YXIgdmVydGljYWxQb3NpdGlvbiA9IHRoaXMuJGVsZW1lbnRbMF0uY2xhc3NOYW1lLm1hdGNoKC8odG9wfGxlZnR8cmlnaHR8Ym90dG9tKS9nKTtcclxuICAgICAgICB2ZXJ0aWNhbFBvc2l0aW9uID0gdmVydGljYWxQb3NpdGlvbiA/IHZlcnRpY2FsUG9zaXRpb25bMF0gOiAnJztcclxuICAgIHZhciBob3Jpem9udGFsUG9zaXRpb24gPSAvZmxvYXQtKFxcUyspLy5leGVjKHRoaXMuJGFuY2hvclswXS5jbGFzc05hbWUpO1xyXG4gICAgICAgIGhvcml6b250YWxQb3NpdGlvbiA9IGhvcml6b250YWxQb3NpdGlvbiA/IGhvcml6b250YWxQb3NpdGlvblsxXSA6ICcnO1xyXG4gICAgdmFyIHBvc2l0aW9uID0gaG9yaXpvbnRhbFBvc2l0aW9uID8gaG9yaXpvbnRhbFBvc2l0aW9uICsgJyAnICsgdmVydGljYWxQb3NpdGlvbiA6IHZlcnRpY2FsUG9zaXRpb247XHJcblxyXG4gICAgcmV0dXJuIHBvc2l0aW9uO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRqdXN0cyB0aGUgZHJvcGRvd24gcGFuZXMgb3JpZW50YXRpb24gYnkgYWRkaW5nL3JlbW92aW5nIHBvc2l0aW9uaW5nIGNsYXNzZXMuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKiBAcGFyYW0ge1N0cmluZ30gcG9zaXRpb24gLSBwb3NpdGlvbiBjbGFzcyB0byByZW1vdmUuXHJcbiAgICovXHJcbiAgX3JlcG9zaXRpb24ocG9zaXRpb24pIHtcclxuICAgIHRoaXMudXNlZFBvc2l0aW9ucy5wdXNoKHBvc2l0aW9uID8gcG9zaXRpb24gOiAnYm90dG9tJyk7XHJcbiAgICAvL2RlZmF1bHQsIHRyeSBzd2l0Y2hpbmcgdG8gb3Bwb3NpdGUgc2lkZVxyXG4gICAgaWYoIXBvc2l0aW9uICYmICh0aGlzLnVzZWRQb3NpdGlvbnMuaW5kZXhPZigndG9wJykgPCAwKSl7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQuYWRkQ2xhc3MoJ3RvcCcpO1xyXG4gICAgfWVsc2UgaWYocG9zaXRpb24gPT09ICd0b3AnICYmICh0aGlzLnVzZWRQb3NpdGlvbnMuaW5kZXhPZignYm90dG9tJykgPCAwKSl7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQucmVtb3ZlQ2xhc3MocG9zaXRpb24pO1xyXG4gICAgfWVsc2UgaWYocG9zaXRpb24gPT09ICdsZWZ0JyAmJiAodGhpcy51c2VkUG9zaXRpb25zLmluZGV4T2YoJ3JpZ2h0JykgPCAwKSl7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQucmVtb3ZlQ2xhc3MocG9zaXRpb24pXHJcbiAgICAgICAgICAuYWRkQ2xhc3MoJ3JpZ2h0Jyk7XHJcbiAgICB9ZWxzZSBpZihwb3NpdGlvbiA9PT0gJ3JpZ2h0JyAmJiAodGhpcy51c2VkUG9zaXRpb25zLmluZGV4T2YoJ2xlZnQnKSA8IDApKXtcclxuICAgICAgdGhpcy4kZWxlbWVudC5yZW1vdmVDbGFzcyhwb3NpdGlvbilcclxuICAgICAgICAgIC5hZGRDbGFzcygnbGVmdCcpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vaWYgZGVmYXVsdCBjaGFuZ2UgZGlkbid0IHdvcmssIHRyeSBib3R0b20gb3IgbGVmdCBmaXJzdFxyXG4gICAgZWxzZSBpZighcG9zaXRpb24gJiYgKHRoaXMudXNlZFBvc2l0aW9ucy5pbmRleE9mKCd0b3AnKSA+IC0xKSAmJiAodGhpcy51c2VkUG9zaXRpb25zLmluZGV4T2YoJ2xlZnQnKSA8IDApKXtcclxuICAgICAgdGhpcy4kZWxlbWVudC5hZGRDbGFzcygnbGVmdCcpO1xyXG4gICAgfWVsc2UgaWYocG9zaXRpb24gPT09ICd0b3AnICYmICh0aGlzLnVzZWRQb3NpdGlvbnMuaW5kZXhPZignYm90dG9tJykgPiAtMSkgJiYgKHRoaXMudXNlZFBvc2l0aW9ucy5pbmRleE9mKCdsZWZ0JykgPCAwKSl7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQucmVtb3ZlQ2xhc3MocG9zaXRpb24pXHJcbiAgICAgICAgICAuYWRkQ2xhc3MoJ2xlZnQnKTtcclxuICAgIH1lbHNlIGlmKHBvc2l0aW9uID09PSAnbGVmdCcgJiYgKHRoaXMudXNlZFBvc2l0aW9ucy5pbmRleE9mKCdyaWdodCcpID4gLTEpICYmICh0aGlzLnVzZWRQb3NpdGlvbnMuaW5kZXhPZignYm90dG9tJykgPCAwKSl7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQucmVtb3ZlQ2xhc3MocG9zaXRpb24pO1xyXG4gICAgfWVsc2UgaWYocG9zaXRpb24gPT09ICdyaWdodCcgJiYgKHRoaXMudXNlZFBvc2l0aW9ucy5pbmRleE9mKCdsZWZ0JykgPiAtMSkgJiYgKHRoaXMudXNlZFBvc2l0aW9ucy5pbmRleE9mKCdib3R0b20nKSA8IDApKXtcclxuICAgICAgdGhpcy4kZWxlbWVudC5yZW1vdmVDbGFzcyhwb3NpdGlvbik7XHJcbiAgICB9XHJcbiAgICAvL2lmIG5vdGhpbmcgY2xlYXJlZCwgc2V0IHRvIGJvdHRvbVxyXG4gICAgZWxzZXtcclxuICAgICAgdGhpcy4kZWxlbWVudC5yZW1vdmVDbGFzcyhwb3NpdGlvbik7XHJcbiAgICB9XHJcbiAgICB0aGlzLmNsYXNzQ2hhbmdlZCA9IHRydWU7XHJcbiAgICB0aGlzLmNvdW50ZXItLTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgdGhlIHBvc2l0aW9uIGFuZCBvcmllbnRhdGlvbiBvZiB0aGUgZHJvcGRvd24gcGFuZSwgY2hlY2tzIGZvciBjb2xsaXNpb25zLlxyXG4gICAqIFJlY3Vyc2l2ZWx5IGNhbGxzIGl0c2VsZiBpZiBhIGNvbGxpc2lvbiBpcyBkZXRlY3RlZCwgd2l0aCBhIG5ldyBwb3NpdGlvbiBjbGFzcy5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9zZXRQb3NpdGlvbigpIHtcclxuICAgIGlmKHRoaXMuJGFuY2hvci5hdHRyKCdhcmlhLWV4cGFuZGVkJykgPT09ICdmYWxzZScpeyByZXR1cm4gZmFsc2U7IH1cclxuICAgIHZhciBwb3NpdGlvbiA9IHRoaXMuZ2V0UG9zaXRpb25DbGFzcygpLFxyXG4gICAgICAgICRlbGVEaW1zID0gRm91bmRhdGlvbi5Cb3guR2V0RGltZW5zaW9ucyh0aGlzLiRlbGVtZW50KSxcclxuICAgICAgICAkYW5jaG9yRGltcyA9IEZvdW5kYXRpb24uQm94LkdldERpbWVuc2lvbnModGhpcy4kYW5jaG9yKSxcclxuICAgICAgICBfdGhpcyA9IHRoaXMsXHJcbiAgICAgICAgZGlyZWN0aW9uID0gKHBvc2l0aW9uID09PSAnbGVmdCcgPyAnbGVmdCcgOiAoKHBvc2l0aW9uID09PSAncmlnaHQnKSA/ICdsZWZ0JyA6ICd0b3AnKSksXHJcbiAgICAgICAgcGFyYW0gPSAoZGlyZWN0aW9uID09PSAndG9wJykgPyAnaGVpZ2h0JyA6ICd3aWR0aCcsXHJcbiAgICAgICAgb2Zmc2V0ID0gKHBhcmFtID09PSAnaGVpZ2h0JykgPyB0aGlzLm9wdGlvbnMudk9mZnNldCA6IHRoaXMub3B0aW9ucy5oT2Zmc2V0O1xyXG5cclxuICAgIGlmKCgkZWxlRGltcy53aWR0aCA+PSAkZWxlRGltcy53aW5kb3dEaW1zLndpZHRoKSB8fCAoIXRoaXMuY291bnRlciAmJiAhRm91bmRhdGlvbi5Cb3guSW1Ob3RUb3VjaGluZ1lvdSh0aGlzLiRlbGVtZW50LCB0aGlzLiRwYXJlbnQpKSl7XHJcbiAgICAgIHZhciBuZXdXaWR0aCA9ICRlbGVEaW1zLndpbmRvd0RpbXMud2lkdGgsXHJcbiAgICAgICAgICBwYXJlbnRIT2Zmc2V0ID0gMDtcclxuICAgICAgaWYodGhpcy4kcGFyZW50KXtcclxuICAgICAgICB2YXIgJHBhcmVudERpbXMgPSBGb3VuZGF0aW9uLkJveC5HZXREaW1lbnNpb25zKHRoaXMuJHBhcmVudCksXHJcbiAgICAgICAgICAgIHBhcmVudEhPZmZzZXQgPSAkcGFyZW50RGltcy5vZmZzZXQubGVmdDtcclxuICAgICAgICBpZiAoJHBhcmVudERpbXMud2lkdGggPCBuZXdXaWR0aCl7XHJcbiAgICAgICAgICBuZXdXaWR0aCA9ICRwYXJlbnREaW1zLndpZHRoO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgdGhpcy4kZWxlbWVudC5vZmZzZXQoRm91bmRhdGlvbi5Cb3guR2V0T2Zmc2V0cyh0aGlzLiRlbGVtZW50LCB0aGlzLiRhbmNob3IsICdjZW50ZXIgYm90dG9tJywgdGhpcy5vcHRpb25zLnZPZmZzZXQsIHRoaXMub3B0aW9ucy5oT2Zmc2V0ICsgcGFyZW50SE9mZnNldCwgdHJ1ZSkpLmNzcyh7XHJcbiAgICAgICAgJ3dpZHRoJzogbmV3V2lkdGggLSAodGhpcy5vcHRpb25zLmhPZmZzZXQgKiAyKSxcclxuICAgICAgICAnaGVpZ2h0JzogJ2F1dG8nXHJcbiAgICAgIH0pO1xyXG4gICAgICB0aGlzLmNsYXNzQ2hhbmdlZCA9IHRydWU7XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLiRlbGVtZW50Lm9mZnNldChGb3VuZGF0aW9uLkJveC5HZXRPZmZzZXRzKHRoaXMuJGVsZW1lbnQsIHRoaXMuJGFuY2hvciwgcG9zaXRpb24sIHRoaXMub3B0aW9ucy52T2Zmc2V0LCB0aGlzLm9wdGlvbnMuaE9mZnNldCkpO1xyXG5cclxuICAgIHdoaWxlKCFGb3VuZGF0aW9uLkJveC5JbU5vdFRvdWNoaW5nWW91KHRoaXMuJGVsZW1lbnQsIHRoaXMuJHBhcmVudCwgdHJ1ZSkgJiYgdGhpcy5jb3VudGVyKXtcclxuICAgICAgdGhpcy5fcmVwb3NpdGlvbihwb3NpdGlvbik7XHJcbiAgICAgIHRoaXMuX3NldFBvc2l0aW9uKCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGRzIGV2ZW50IGxpc3RlbmVycyB0byB0aGUgZWxlbWVudCB1dGlsaXppbmcgdGhlIHRyaWdnZXJzIHV0aWxpdHkgbGlicmFyeS5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9ldmVudHMoKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgdGhpcy4kZWxlbWVudC5vbih7XHJcbiAgICAgICdvcGVuLnpmLnRyaWdnZXInOiB0aGlzLm9wZW4uYmluZCh0aGlzKSxcclxuICAgICAgJ2Nsb3NlLnpmLnRyaWdnZXInOiB0aGlzLmNsb3NlLmJpbmQodGhpcyksXHJcbiAgICAgICd0b2dnbGUuemYudHJpZ2dlcic6IHRoaXMudG9nZ2xlLmJpbmQodGhpcyksXHJcbiAgICAgICdyZXNpemVtZS56Zi50cmlnZ2VyJzogdGhpcy5fc2V0UG9zaXRpb24uYmluZCh0aGlzKVxyXG4gICAgfSk7XHJcblxyXG4gICAgaWYodGhpcy5vcHRpb25zLmhvdmVyKXtcclxuICAgICAgdGhpcy4kYW5jaG9yLm9mZignbW91c2VlbnRlci56Zi5kcm9wZG93biBtb3VzZWxlYXZlLnpmLmRyb3Bkb3duJylcclxuICAgICAgLm9uKCdtb3VzZWVudGVyLnpmLmRyb3Bkb3duJywgZnVuY3Rpb24oKXtcclxuICAgICAgICB2YXIgYm9keURhdGEgPSAkKCdib2R5JykuZGF0YSgpO1xyXG4gICAgICAgIGlmKHR5cGVvZihib2R5RGF0YS53aGF0aW5wdXQpID09PSAndW5kZWZpbmVkJyB8fCBib2R5RGF0YS53aGF0aW5wdXQgPT09ICdtb3VzZScpIHtcclxuICAgICAgICAgIGNsZWFyVGltZW91dChfdGhpcy50aW1lb3V0KTtcclxuICAgICAgICAgIF90aGlzLnRpbWVvdXQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgIF90aGlzLm9wZW4oKTtcclxuICAgICAgICAgICAgX3RoaXMuJGFuY2hvci5kYXRhKCdob3ZlcicsIHRydWUpO1xyXG4gICAgICAgICAgfSwgX3RoaXMub3B0aW9ucy5ob3ZlckRlbGF5KTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pLm9uKCdtb3VzZWxlYXZlLnpmLmRyb3Bkb3duJywgZnVuY3Rpb24oKXtcclxuICAgICAgICBjbGVhclRpbWVvdXQoX3RoaXMudGltZW91dCk7XHJcbiAgICAgICAgX3RoaXMudGltZW91dCA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcclxuICAgICAgICAgIF90aGlzLmNsb3NlKCk7XHJcbiAgICAgICAgICBfdGhpcy4kYW5jaG9yLmRhdGEoJ2hvdmVyJywgZmFsc2UpO1xyXG4gICAgICAgIH0sIF90aGlzLm9wdGlvbnMuaG92ZXJEZWxheSk7XHJcbiAgICAgIH0pO1xyXG4gICAgICBpZih0aGlzLm9wdGlvbnMuaG92ZXJQYW5lKXtcclxuICAgICAgICB0aGlzLiRlbGVtZW50Lm9mZignbW91c2VlbnRlci56Zi5kcm9wZG93biBtb3VzZWxlYXZlLnpmLmRyb3Bkb3duJylcclxuICAgICAgICAgICAgLm9uKCdtb3VzZWVudGVyLnpmLmRyb3Bkb3duJywgZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgICBjbGVhclRpbWVvdXQoX3RoaXMudGltZW91dCk7XHJcbiAgICAgICAgICAgIH0pLm9uKCdtb3VzZWxlYXZlLnpmLmRyb3Bkb3duJywgZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgICBjbGVhclRpbWVvdXQoX3RoaXMudGltZW91dCk7XHJcbiAgICAgICAgICAgICAgX3RoaXMudGltZW91dCA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgICAgIF90aGlzLmNsb3NlKCk7XHJcbiAgICAgICAgICAgICAgICBfdGhpcy4kYW5jaG9yLmRhdGEoJ2hvdmVyJywgZmFsc2UpO1xyXG4gICAgICAgICAgICAgIH0sIF90aGlzLm9wdGlvbnMuaG92ZXJEZWxheSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICB0aGlzLiRhbmNob3IuYWRkKHRoaXMuJGVsZW1lbnQpLm9uKCdrZXlkb3duLnpmLmRyb3Bkb3duJywgZnVuY3Rpb24oZSkge1xyXG5cclxuICAgICAgdmFyICR0YXJnZXQgPSAkKHRoaXMpLFxyXG4gICAgICAgIHZpc2libGVGb2N1c2FibGVFbGVtZW50cyA9IEZvdW5kYXRpb24uS2V5Ym9hcmQuZmluZEZvY3VzYWJsZShfdGhpcy4kZWxlbWVudCk7XHJcblxyXG4gICAgICBGb3VuZGF0aW9uLktleWJvYXJkLmhhbmRsZUtleShlLCAnRHJvcGRvd24nLCB7XHJcbiAgICAgICAgb3BlbjogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICBpZiAoJHRhcmdldC5pcyhfdGhpcy4kYW5jaG9yKSkge1xyXG4gICAgICAgICAgICBfdGhpcy5vcGVuKCk7XHJcbiAgICAgICAgICAgIF90aGlzLiRlbGVtZW50LmF0dHIoJ3RhYmluZGV4JywgLTEpLmZvY3VzKCk7XHJcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIGNsb3NlOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgIF90aGlzLmNsb3NlKCk7XHJcbiAgICAgICAgICBfdGhpcy4kYW5jaG9yLmZvY3VzKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBhbiBldmVudCBoYW5kbGVyIHRvIHRoZSBib2R5IHRvIGNsb3NlIGFueSBkcm9wZG93bnMgb24gYSBjbGljay5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9hZGRCb2R5SGFuZGxlcigpIHtcclxuICAgICB2YXIgJGJvZHkgPSAkKGRvY3VtZW50LmJvZHkpLm5vdCh0aGlzLiRlbGVtZW50KSxcclxuICAgICAgICAgX3RoaXMgPSB0aGlzO1xyXG4gICAgICRib2R5Lm9mZignY2xpY2suemYuZHJvcGRvd24nKVxyXG4gICAgICAgICAgLm9uKCdjbGljay56Zi5kcm9wZG93bicsIGZ1bmN0aW9uKGUpe1xyXG4gICAgICAgICAgICBpZihfdGhpcy4kYW5jaG9yLmlzKGUudGFyZ2V0KSB8fCBfdGhpcy4kYW5jaG9yLmZpbmQoZS50YXJnZXQpLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZihfdGhpcy4kZWxlbWVudC5maW5kKGUudGFyZ2V0KS5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgX3RoaXMuY2xvc2UoKTtcclxuICAgICAgICAgICAgJGJvZHkub2ZmKCdjbGljay56Zi5kcm9wZG93bicpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBPcGVucyB0aGUgZHJvcGRvd24gcGFuZSwgYW5kIGZpcmVzIGEgYnViYmxpbmcgZXZlbnQgdG8gY2xvc2Ugb3RoZXIgZHJvcGRvd25zLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBmaXJlcyBEcm9wZG93biNjbG9zZW1lXHJcbiAgICogQGZpcmVzIERyb3Bkb3duI3Nob3dcclxuICAgKi9cclxuICBvcGVuKCkge1xyXG4gICAgLy8gdmFyIF90aGlzID0gdGhpcztcclxuICAgIC8qKlxyXG4gICAgICogRmlyZXMgdG8gY2xvc2Ugb3RoZXIgb3BlbiBkcm9wZG93bnNcclxuICAgICAqIEBldmVudCBEcm9wZG93biNjbG9zZW1lXHJcbiAgICAgKi9cclxuICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcignY2xvc2VtZS56Zi5kcm9wZG93bicsIHRoaXMuJGVsZW1lbnQuYXR0cignaWQnKSk7XHJcbiAgICB0aGlzLiRhbmNob3IuYWRkQ2xhc3MoJ2hvdmVyJylcclxuICAgICAgICAuYXR0cih7J2FyaWEtZXhwYW5kZWQnOiB0cnVlfSk7XHJcbiAgICAvLyB0aGlzLiRlbGVtZW50Lyouc2hvdygpKi87XHJcbiAgICB0aGlzLl9zZXRQb3NpdGlvbigpO1xyXG4gICAgdGhpcy4kZWxlbWVudC5hZGRDbGFzcygnaXMtb3BlbicpXHJcbiAgICAgICAgLmF0dHIoeydhcmlhLWhpZGRlbic6IGZhbHNlfSk7XHJcblxyXG4gICAgaWYodGhpcy5vcHRpb25zLmF1dG9Gb2N1cyl7XHJcbiAgICAgIHZhciAkZm9jdXNhYmxlID0gRm91bmRhdGlvbi5LZXlib2FyZC5maW5kRm9jdXNhYmxlKHRoaXMuJGVsZW1lbnQpO1xyXG4gICAgICBpZigkZm9jdXNhYmxlLmxlbmd0aCl7XHJcbiAgICAgICAgJGZvY3VzYWJsZS5lcSgwKS5mb2N1cygpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYodGhpcy5vcHRpb25zLmNsb3NlT25DbGljayl7IHRoaXMuX2FkZEJvZHlIYW5kbGVyKCk7IH1cclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLnRyYXBGb2N1cykge1xyXG4gICAgICBGb3VuZGF0aW9uLktleWJvYXJkLnRyYXBGb2N1cyh0aGlzLiRlbGVtZW50KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEZpcmVzIG9uY2UgdGhlIGRyb3Bkb3duIGlzIHZpc2libGUuXHJcbiAgICAgKiBAZXZlbnQgRHJvcGRvd24jc2hvd1xyXG4gICAgICovXHJcbiAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ3Nob3cuemYuZHJvcGRvd24nLCBbdGhpcy4kZWxlbWVudF0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2xvc2VzIHRoZSBvcGVuIGRyb3Bkb3duIHBhbmUuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQGZpcmVzIERyb3Bkb3duI2hpZGVcclxuICAgKi9cclxuICBjbG9zZSgpIHtcclxuICAgIGlmKCF0aGlzLiRlbGVtZW50Lmhhc0NsYXNzKCdpcy1vcGVuJykpe1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbiAgICB0aGlzLiRlbGVtZW50LnJlbW92ZUNsYXNzKCdpcy1vcGVuJylcclxuICAgICAgICAuYXR0cih7J2FyaWEtaGlkZGVuJzogdHJ1ZX0pO1xyXG5cclxuICAgIHRoaXMuJGFuY2hvci5yZW1vdmVDbGFzcygnaG92ZXInKVxyXG4gICAgICAgIC5hdHRyKCdhcmlhLWV4cGFuZGVkJywgZmFsc2UpO1xyXG5cclxuICAgIGlmKHRoaXMuY2xhc3NDaGFuZ2VkKXtcclxuICAgICAgdmFyIGN1clBvc2l0aW9uQ2xhc3MgPSB0aGlzLmdldFBvc2l0aW9uQ2xhc3MoKTtcclxuICAgICAgaWYoY3VyUG9zaXRpb25DbGFzcyl7XHJcbiAgICAgICAgdGhpcy4kZWxlbWVudC5yZW1vdmVDbGFzcyhjdXJQb3NpdGlvbkNsYXNzKTtcclxuICAgICAgfVxyXG4gICAgICB0aGlzLiRlbGVtZW50LmFkZENsYXNzKHRoaXMub3B0aW9ucy5wb3NpdGlvbkNsYXNzKVxyXG4gICAgICAgICAgLyouaGlkZSgpKi8uY3NzKHtoZWlnaHQ6ICcnLCB3aWR0aDogJyd9KTtcclxuICAgICAgdGhpcy5jbGFzc0NoYW5nZWQgPSBmYWxzZTtcclxuICAgICAgdGhpcy5jb3VudGVyID0gNDtcclxuICAgICAgdGhpcy51c2VkUG9zaXRpb25zLmxlbmd0aCA9IDA7XHJcbiAgICB9XHJcbiAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ2hpZGUuemYuZHJvcGRvd24nLCBbdGhpcy4kZWxlbWVudF0pO1xyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMudHJhcEZvY3VzKSB7XHJcbiAgICAgIEZvdW5kYXRpb24uS2V5Ym9hcmQucmVsZWFzZUZvY3VzKHRoaXMuJGVsZW1lbnQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVG9nZ2xlcyB0aGUgZHJvcGRvd24gcGFuZSdzIHZpc2liaWxpdHkuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgdG9nZ2xlKCkge1xyXG4gICAgaWYodGhpcy4kZWxlbWVudC5oYXNDbGFzcygnaXMtb3BlbicpKXtcclxuICAgICAgaWYodGhpcy4kYW5jaG9yLmRhdGEoJ2hvdmVyJykpIHJldHVybjtcclxuICAgICAgdGhpcy5jbG9zZSgpO1xyXG4gICAgfWVsc2V7XHJcbiAgICAgIHRoaXMub3BlbigpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVzdHJveXMgdGhlIGRyb3Bkb3duLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIGRlc3Ryb3koKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50Lm9mZignLnpmLnRyaWdnZXInKS5oaWRlKCk7XHJcbiAgICB0aGlzLiRhbmNob3Iub2ZmKCcuemYuZHJvcGRvd24nKTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLnVucmVnaXN0ZXJQbHVnaW4odGhpcyk7XHJcbiAgfVxyXG59XHJcblxyXG5Ecm9wZG93bi5kZWZhdWx0cyA9IHtcclxuICAvKipcclxuICAgKiBDbGFzcyB0aGF0IGRlc2lnbmF0ZXMgYm91bmRpbmcgY29udGFpbmVyIG9mIERyb3Bkb3duIChEZWZhdWx0OiB3aW5kb3cpXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICdkcm9wZG93bi1wYXJlbnQnXHJcbiAgICovXHJcbiAgcGFyZW50Q2xhc3M6IG51bGwsXHJcbiAgLyoqXHJcbiAgICogQW1vdW50IG9mIHRpbWUgdG8gZGVsYXkgb3BlbmluZyBhIHN1Ym1lbnUgb24gaG92ZXIgZXZlbnQuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDI1MFxyXG4gICAqL1xyXG4gIGhvdmVyRGVsYXk6IDI1MCxcclxuICAvKipcclxuICAgKiBBbGxvdyBzdWJtZW51cyB0byBvcGVuIG9uIGhvdmVyIGV2ZW50c1xyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIGhvdmVyOiBmYWxzZSxcclxuICAvKipcclxuICAgKiBEb24ndCBjbG9zZSBkcm9wZG93biB3aGVuIGhvdmVyaW5nIG92ZXIgZHJvcGRvd24gcGFuZVxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSB0cnVlXHJcbiAgICovXHJcbiAgaG92ZXJQYW5lOiBmYWxzZSxcclxuICAvKipcclxuICAgKiBOdW1iZXIgb2YgcGl4ZWxzIGJldHdlZW4gdGhlIGRyb3Bkb3duIHBhbmUgYW5kIHRoZSB0cmlnZ2VyaW5nIGVsZW1lbnQgb24gb3Blbi5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgMVxyXG4gICAqL1xyXG4gIHZPZmZzZXQ6IDEsXHJcbiAgLyoqXHJcbiAgICogTnVtYmVyIG9mIHBpeGVscyBiZXR3ZWVuIHRoZSBkcm9wZG93biBwYW5lIGFuZCB0aGUgdHJpZ2dlcmluZyBlbGVtZW50IG9uIG9wZW4uXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDFcclxuICAgKi9cclxuICBoT2Zmc2V0OiAxLFxyXG4gIC8qKlxyXG4gICAqIENsYXNzIGFwcGxpZWQgdG8gYWRqdXN0IG9wZW4gcG9zaXRpb24uIEpTIHdpbGwgdGVzdCBhbmQgZmlsbCB0aGlzIGluLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAndG9wJ1xyXG4gICAqL1xyXG4gIHBvc2l0aW9uQ2xhc3M6ICcnLFxyXG4gIC8qKlxyXG4gICAqIEFsbG93IHRoZSBwbHVnaW4gdG8gdHJhcCBmb2N1cyB0byB0aGUgZHJvcGRvd24gcGFuZSBpZiBvcGVuZWQgd2l0aCBrZXlib2FyZCBjb21tYW5kcy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICB0cmFwRm9jdXM6IGZhbHNlLFxyXG4gIC8qKlxyXG4gICAqIEFsbG93IHRoZSBwbHVnaW4gdG8gc2V0IGZvY3VzIHRvIHRoZSBmaXJzdCBmb2N1c2FibGUgZWxlbWVudCB3aXRoaW4gdGhlIHBhbmUsIHJlZ2FyZGxlc3Mgb2YgbWV0aG9kIG9mIG9wZW5pbmcuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIHRydWVcclxuICAgKi9cclxuICBhdXRvRm9jdXM6IGZhbHNlLFxyXG4gIC8qKlxyXG4gICAqIEFsbG93cyBhIGNsaWNrIG9uIHRoZSBib2R5IHRvIGNsb3NlIHRoZSBkcm9wZG93bi5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBjbG9zZU9uQ2xpY2s6IGZhbHNlXHJcbn1cclxuXHJcbi8vIFdpbmRvdyBleHBvcnRzXHJcbkZvdW5kYXRpb24ucGx1Z2luKERyb3Bkb3duLCAnRHJvcGRvd24nKTtcclxuXHJcbn0oalF1ZXJ5KTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuIWZ1bmN0aW9uKCQpIHtcclxuXHJcbi8qKlxyXG4gKiBEcm9wZG93bk1lbnUgbW9kdWxlLlxyXG4gKiBAbW9kdWxlIGZvdW5kYXRpb24uZHJvcGRvd24tbWVudVxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLmtleWJvYXJkXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwuYm94XHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwubmVzdFxyXG4gKi9cclxuXHJcbmNsYXNzIERyb3Bkb3duTWVudSB7XHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlcyBhIG5ldyBpbnN0YW5jZSBvZiBEcm9wZG93bk1lbnUuXHJcbiAgICogQGNsYXNzXHJcbiAgICogQGZpcmVzIERyb3Bkb3duTWVudSNpbml0XHJcbiAgICogQHBhcmFtIHtqUXVlcnl9IGVsZW1lbnQgLSBqUXVlcnkgb2JqZWN0IHRvIG1ha2UgaW50byBhIGRyb3Bkb3duIG1lbnUuXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgLSBPdmVycmlkZXMgdG8gdGhlIGRlZmF1bHQgcGx1Z2luIHNldHRpbmdzLlxyXG4gICAqL1xyXG4gIGNvbnN0cnVjdG9yKGVsZW1lbnQsIG9wdGlvbnMpIHtcclxuICAgIHRoaXMuJGVsZW1lbnQgPSBlbGVtZW50O1xyXG4gICAgdGhpcy5vcHRpb25zID0gJC5leHRlbmQoe30sIERyb3Bkb3duTWVudS5kZWZhdWx0cywgdGhpcy4kZWxlbWVudC5kYXRhKCksIG9wdGlvbnMpO1xyXG5cclxuICAgIEZvdW5kYXRpb24uTmVzdC5GZWF0aGVyKHRoaXMuJGVsZW1lbnQsICdkcm9wZG93bicpO1xyXG4gICAgdGhpcy5faW5pdCgpO1xyXG5cclxuICAgIEZvdW5kYXRpb24ucmVnaXN0ZXJQbHVnaW4odGhpcywgJ0Ryb3Bkb3duTWVudScpO1xyXG4gICAgRm91bmRhdGlvbi5LZXlib2FyZC5yZWdpc3RlcignRHJvcGRvd25NZW51Jywge1xyXG4gICAgICAnRU5URVInOiAnb3BlbicsXHJcbiAgICAgICdTUEFDRSc6ICdvcGVuJyxcclxuICAgICAgJ0FSUk9XX1JJR0hUJzogJ25leHQnLFxyXG4gICAgICAnQVJST1dfVVAnOiAndXAnLFxyXG4gICAgICAnQVJST1dfRE9XTic6ICdkb3duJyxcclxuICAgICAgJ0FSUk9XX0xFRlQnOiAncHJldmlvdXMnLFxyXG4gICAgICAnRVNDQVBFJzogJ2Nsb3NlJ1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJbml0aWFsaXplcyB0aGUgcGx1Z2luLCBhbmQgY2FsbHMgX3ByZXBhcmVNZW51XHJcbiAgICogQHByaXZhdGVcclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICBfaW5pdCgpIHtcclxuICAgIHZhciBzdWJzID0gdGhpcy4kZWxlbWVudC5maW5kKCdsaS5pcy1kcm9wZG93bi1zdWJtZW51LXBhcmVudCcpO1xyXG4gICAgdGhpcy4kZWxlbWVudC5jaGlsZHJlbignLmlzLWRyb3Bkb3duLXN1Ym1lbnUtcGFyZW50JykuY2hpbGRyZW4oJy5pcy1kcm9wZG93bi1zdWJtZW51JykuYWRkQ2xhc3MoJ2ZpcnN0LXN1YicpO1xyXG5cclxuICAgIHRoaXMuJG1lbnVJdGVtcyA9IHRoaXMuJGVsZW1lbnQuZmluZCgnW3JvbGU9XCJtZW51aXRlbVwiXScpO1xyXG4gICAgdGhpcy4kdGFicyA9IHRoaXMuJGVsZW1lbnQuY2hpbGRyZW4oJ1tyb2xlPVwibWVudWl0ZW1cIl0nKTtcclxuICAgIHRoaXMuJHRhYnMuZmluZCgndWwuaXMtZHJvcGRvd24tc3VibWVudScpLmFkZENsYXNzKHRoaXMub3B0aW9ucy52ZXJ0aWNhbENsYXNzKTtcclxuXHJcbiAgICBpZiAodGhpcy4kZWxlbWVudC5oYXNDbGFzcyh0aGlzLm9wdGlvbnMucmlnaHRDbGFzcykgfHwgdGhpcy5vcHRpb25zLmFsaWdubWVudCA9PT0gJ3JpZ2h0JyB8fCBGb3VuZGF0aW9uLnJ0bCgpIHx8IHRoaXMuJGVsZW1lbnQucGFyZW50cygnLnRvcC1iYXItcmlnaHQnKS5pcygnKicpKSB7XHJcbiAgICAgIHRoaXMub3B0aW9ucy5hbGlnbm1lbnQgPSAncmlnaHQnO1xyXG4gICAgICBzdWJzLmFkZENsYXNzKCdvcGVucy1sZWZ0Jyk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBzdWJzLmFkZENsYXNzKCdvcGVucy1yaWdodCcpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5jaGFuZ2VkID0gZmFsc2U7XHJcbiAgICB0aGlzLl9ldmVudHMoKTtcclxuICB9O1xyXG5cclxuICBfaXNWZXJ0aWNhbCgpIHtcclxuICAgIHJldHVybiB0aGlzLiR0YWJzLmNzcygnZGlzcGxheScpID09PSAnYmxvY2snO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBldmVudCBsaXN0ZW5lcnMgdG8gZWxlbWVudHMgd2l0aGluIHRoZSBtZW51XHJcbiAgICogQHByaXZhdGVcclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICBfZXZlbnRzKCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcyxcclxuICAgICAgICBoYXNUb3VjaCA9ICdvbnRvdWNoc3RhcnQnIGluIHdpbmRvdyB8fCAodHlwZW9mIHdpbmRvdy5vbnRvdWNoc3RhcnQgIT09ICd1bmRlZmluZWQnKSxcclxuICAgICAgICBwYXJDbGFzcyA9ICdpcy1kcm9wZG93bi1zdWJtZW51LXBhcmVudCc7XHJcblxyXG4gICAgLy8gdXNlZCBmb3Igb25DbGljayBhbmQgaW4gdGhlIGtleWJvYXJkIGhhbmRsZXJzXHJcbiAgICB2YXIgaGFuZGxlQ2xpY2tGbiA9IGZ1bmN0aW9uKGUpIHtcclxuICAgICAgdmFyICRlbGVtID0gJChlLnRhcmdldCkucGFyZW50c1VudGlsKCd1bCcsIGAuJHtwYXJDbGFzc31gKSxcclxuICAgICAgICAgIGhhc1N1YiA9ICRlbGVtLmhhc0NsYXNzKHBhckNsYXNzKSxcclxuICAgICAgICAgIGhhc0NsaWNrZWQgPSAkZWxlbS5hdHRyKCdkYXRhLWlzLWNsaWNrJykgPT09ICd0cnVlJyxcclxuICAgICAgICAgICRzdWIgPSAkZWxlbS5jaGlsZHJlbignLmlzLWRyb3Bkb3duLXN1Ym1lbnUnKTtcclxuXHJcbiAgICAgIGlmIChoYXNTdWIpIHtcclxuICAgICAgICBpZiAoaGFzQ2xpY2tlZCkge1xyXG4gICAgICAgICAgaWYgKCFfdGhpcy5vcHRpb25zLmNsb3NlT25DbGljayB8fCAoIV90aGlzLm9wdGlvbnMuY2xpY2tPcGVuICYmICFoYXNUb3VjaCkgfHwgKF90aGlzLm9wdGlvbnMuZm9yY2VGb2xsb3cgJiYgaGFzVG91Y2gpKSB7IHJldHVybjsgfVxyXG4gICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XHJcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgX3RoaXMuX2hpZGUoJGVsZW0pO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICBlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgICAgX3RoaXMuX3Nob3coJHN1Yik7XHJcbiAgICAgICAgICAkZWxlbS5hZGQoJGVsZW0ucGFyZW50c1VudGlsKF90aGlzLiRlbGVtZW50LCBgLiR7cGFyQ2xhc3N9YCkpLmF0dHIoJ2RhdGEtaXMtY2xpY2snLCB0cnVlKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5jbGlja09wZW4gfHwgaGFzVG91Y2gpIHtcclxuICAgICAgdGhpcy4kbWVudUl0ZW1zLm9uKCdjbGljay56Zi5kcm9wZG93bm1lbnUgdG91Y2hzdGFydC56Zi5kcm9wZG93bm1lbnUnLCBoYW5kbGVDbGlja0ZuKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBIYW5kbGUgTGVhZiBlbGVtZW50IENsaWNrc1xyXG4gICAgaWYoX3RoaXMub3B0aW9ucy5jbG9zZU9uQ2xpY2tJbnNpZGUpe1xyXG4gICAgICB0aGlzLiRtZW51SXRlbXMub24oJ2NsaWNrLnpmLmRyb3Bkb3dubWVudSB0b3VjaGVuZC56Zi5kcm9wZG93bm1lbnUnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgdmFyICRlbGVtID0gJCh0aGlzKSxcclxuICAgICAgICAgICAgaGFzU3ViID0gJGVsZW0uaGFzQ2xhc3MocGFyQ2xhc3MpO1xyXG4gICAgICAgIGlmKCFoYXNTdWIpe1xyXG4gICAgICAgICAgX3RoaXMuX2hpZGUoKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICghdGhpcy5vcHRpb25zLmRpc2FibGVIb3Zlcikge1xyXG4gICAgICB0aGlzLiRtZW51SXRlbXMub24oJ21vdXNlZW50ZXIuemYuZHJvcGRvd25tZW51JywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIHZhciAkZWxlbSA9ICQodGhpcyksXHJcbiAgICAgICAgICAgIGhhc1N1YiA9ICRlbGVtLmhhc0NsYXNzKHBhckNsYXNzKTtcclxuXHJcbiAgICAgICAgaWYgKGhhc1N1Yikge1xyXG4gICAgICAgICAgY2xlYXJUaW1lb3V0KCRlbGVtLmRhdGEoJ19kZWxheScpKTtcclxuICAgICAgICAgICRlbGVtLmRhdGEoJ19kZWxheScsIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIF90aGlzLl9zaG93KCRlbGVtLmNoaWxkcmVuKCcuaXMtZHJvcGRvd24tc3VibWVudScpKTtcclxuICAgICAgICAgIH0sIF90aGlzLm9wdGlvbnMuaG92ZXJEZWxheSkpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSkub24oJ21vdXNlbGVhdmUuemYuZHJvcGRvd25tZW51JywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIHZhciAkZWxlbSA9ICQodGhpcyksXHJcbiAgICAgICAgICAgIGhhc1N1YiA9ICRlbGVtLmhhc0NsYXNzKHBhckNsYXNzKTtcclxuICAgICAgICBpZiAoaGFzU3ViICYmIF90aGlzLm9wdGlvbnMuYXV0b2Nsb3NlKSB7XHJcbiAgICAgICAgICBpZiAoJGVsZW0uYXR0cignZGF0YS1pcy1jbGljaycpID09PSAndHJ1ZScgJiYgX3RoaXMub3B0aW9ucy5jbGlja09wZW4pIHsgcmV0dXJuIGZhbHNlOyB9XHJcblxyXG4gICAgICAgICAgY2xlYXJUaW1lb3V0KCRlbGVtLmRhdGEoJ19kZWxheScpKTtcclxuICAgICAgICAgICRlbGVtLmRhdGEoJ19kZWxheScsIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIF90aGlzLl9oaWRlKCRlbGVtKTtcclxuICAgICAgICAgIH0sIF90aGlzLm9wdGlvbnMuY2xvc2luZ1RpbWUpKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgdGhpcy4kbWVudUl0ZW1zLm9uKCdrZXlkb3duLnpmLmRyb3Bkb3dubWVudScsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgdmFyICRlbGVtZW50ID0gJChlLnRhcmdldCkucGFyZW50c1VudGlsKCd1bCcsICdbcm9sZT1cIm1lbnVpdGVtXCJdJyksXHJcbiAgICAgICAgICBpc1RhYiA9IF90aGlzLiR0YWJzLmluZGV4KCRlbGVtZW50KSA+IC0xLFxyXG4gICAgICAgICAgJGVsZW1lbnRzID0gaXNUYWIgPyBfdGhpcy4kdGFicyA6ICRlbGVtZW50LnNpYmxpbmdzKCdsaScpLmFkZCgkZWxlbWVudCksXHJcbiAgICAgICAgICAkcHJldkVsZW1lbnQsXHJcbiAgICAgICAgICAkbmV4dEVsZW1lbnQ7XHJcblxyXG4gICAgICAkZWxlbWVudHMuZWFjaChmdW5jdGlvbihpKSB7XHJcbiAgICAgICAgaWYgKCQodGhpcykuaXMoJGVsZW1lbnQpKSB7XHJcbiAgICAgICAgICAkcHJldkVsZW1lbnQgPSAkZWxlbWVudHMuZXEoaS0xKTtcclxuICAgICAgICAgICRuZXh0RWxlbWVudCA9ICRlbGVtZW50cy5lcShpKzEpO1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcblxyXG4gICAgICB2YXIgbmV4dFNpYmxpbmcgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICBpZiAoISRlbGVtZW50LmlzKCc6bGFzdC1jaGlsZCcpKSB7XHJcbiAgICAgICAgICAkbmV4dEVsZW1lbnQuY2hpbGRyZW4oJ2E6Zmlyc3QnKS5mb2N1cygpO1xyXG4gICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSwgcHJldlNpYmxpbmcgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAkcHJldkVsZW1lbnQuY2hpbGRyZW4oJ2E6Zmlyc3QnKS5mb2N1cygpO1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgfSwgb3BlblN1YiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHZhciAkc3ViID0gJGVsZW1lbnQuY2hpbGRyZW4oJ3VsLmlzLWRyb3Bkb3duLXN1Ym1lbnUnKTtcclxuICAgICAgICBpZiAoJHN1Yi5sZW5ndGgpIHtcclxuICAgICAgICAgIF90aGlzLl9zaG93KCRzdWIpO1xyXG4gICAgICAgICAgJGVsZW1lbnQuZmluZCgnbGkgPiBhOmZpcnN0JykuZm9jdXMoKTtcclxuICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICB9IGVsc2UgeyByZXR1cm47IH1cclxuICAgICAgfSwgY2xvc2VTdWIgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAvL2lmICgkZWxlbWVudC5pcygnOmZpcnN0LWNoaWxkJykpIHtcclxuICAgICAgICB2YXIgY2xvc2UgPSAkZWxlbWVudC5wYXJlbnQoJ3VsJykucGFyZW50KCdsaScpO1xyXG4gICAgICAgIGNsb3NlLmNoaWxkcmVuKCdhOmZpcnN0JykuZm9jdXMoKTtcclxuICAgICAgICBfdGhpcy5faGlkZShjbG9zZSk7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIC8vfVxyXG4gICAgICB9O1xyXG4gICAgICB2YXIgZnVuY3Rpb25zID0ge1xyXG4gICAgICAgIG9wZW46IG9wZW5TdWIsXHJcbiAgICAgICAgY2xvc2U6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgX3RoaXMuX2hpZGUoX3RoaXMuJGVsZW1lbnQpO1xyXG4gICAgICAgICAgX3RoaXMuJG1lbnVJdGVtcy5maW5kKCdhOmZpcnN0JykuZm9jdXMoKTsgLy8gZm9jdXMgdG8gZmlyc3QgZWxlbWVudFxyXG4gICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgaGFuZGxlZDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICBlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgIH1cclxuICAgICAgfTtcclxuXHJcbiAgICAgIGlmIChpc1RhYikge1xyXG4gICAgICAgIGlmIChfdGhpcy5faXNWZXJ0aWNhbCgpKSB7IC8vIHZlcnRpY2FsIG1lbnVcclxuICAgICAgICAgIGlmIChGb3VuZGF0aW9uLnJ0bCgpKSB7IC8vIHJpZ2h0IGFsaWduZWRcclxuICAgICAgICAgICAgJC5leHRlbmQoZnVuY3Rpb25zLCB7XHJcbiAgICAgICAgICAgICAgZG93bjogbmV4dFNpYmxpbmcsXHJcbiAgICAgICAgICAgICAgdXA6IHByZXZTaWJsaW5nLFxyXG4gICAgICAgICAgICAgIG5leHQ6IGNsb3NlU3ViLFxyXG4gICAgICAgICAgICAgIHByZXZpb3VzOiBvcGVuU3ViXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgfSBlbHNlIHsgLy8gbGVmdCBhbGlnbmVkXHJcbiAgICAgICAgICAgICQuZXh0ZW5kKGZ1bmN0aW9ucywge1xyXG4gICAgICAgICAgICAgIGRvd246IG5leHRTaWJsaW5nLFxyXG4gICAgICAgICAgICAgIHVwOiBwcmV2U2libGluZyxcclxuICAgICAgICAgICAgICBuZXh0OiBvcGVuU3ViLFxyXG4gICAgICAgICAgICAgIHByZXZpb3VzOiBjbG9zZVN1YlxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2UgeyAvLyBob3Jpem9udGFsIG1lbnVcclxuICAgICAgICAgIGlmIChGb3VuZGF0aW9uLnJ0bCgpKSB7IC8vIHJpZ2h0IGFsaWduZWRcclxuICAgICAgICAgICAgJC5leHRlbmQoZnVuY3Rpb25zLCB7XHJcbiAgICAgICAgICAgICAgbmV4dDogcHJldlNpYmxpbmcsXHJcbiAgICAgICAgICAgICAgcHJldmlvdXM6IG5leHRTaWJsaW5nLFxyXG4gICAgICAgICAgICAgIGRvd246IG9wZW5TdWIsXHJcbiAgICAgICAgICAgICAgdXA6IGNsb3NlU3ViXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgfSBlbHNlIHsgLy8gbGVmdCBhbGlnbmVkXHJcbiAgICAgICAgICAgICQuZXh0ZW5kKGZ1bmN0aW9ucywge1xyXG4gICAgICAgICAgICAgIG5leHQ6IG5leHRTaWJsaW5nLFxyXG4gICAgICAgICAgICAgIHByZXZpb3VzOiBwcmV2U2libGluZyxcclxuICAgICAgICAgICAgICBkb3duOiBvcGVuU3ViLFxyXG4gICAgICAgICAgICAgIHVwOiBjbG9zZVN1YlxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSB7IC8vIG5vdCB0YWJzIC0+IG9uZSBzdWJcclxuICAgICAgICBpZiAoRm91bmRhdGlvbi5ydGwoKSkgeyAvLyByaWdodCBhbGlnbmVkXHJcbiAgICAgICAgICAkLmV4dGVuZChmdW5jdGlvbnMsIHtcclxuICAgICAgICAgICAgbmV4dDogY2xvc2VTdWIsXHJcbiAgICAgICAgICAgIHByZXZpb3VzOiBvcGVuU3ViLFxyXG4gICAgICAgICAgICBkb3duOiBuZXh0U2libGluZyxcclxuICAgICAgICAgICAgdXA6IHByZXZTaWJsaW5nXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9IGVsc2UgeyAvLyBsZWZ0IGFsaWduZWRcclxuICAgICAgICAgICQuZXh0ZW5kKGZ1bmN0aW9ucywge1xyXG4gICAgICAgICAgICBuZXh0OiBvcGVuU3ViLFxyXG4gICAgICAgICAgICBwcmV2aW91czogY2xvc2VTdWIsXHJcbiAgICAgICAgICAgIGRvd246IG5leHRTaWJsaW5nLFxyXG4gICAgICAgICAgICB1cDogcHJldlNpYmxpbmdcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBGb3VuZGF0aW9uLktleWJvYXJkLmhhbmRsZUtleShlLCAnRHJvcGRvd25NZW51JywgZnVuY3Rpb25zKTtcclxuXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMgYW4gZXZlbnQgaGFuZGxlciB0byB0aGUgYm9keSB0byBjbG9zZSBhbnkgZHJvcGRvd25zIG9uIGEgY2xpY2suXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfYWRkQm9keUhhbmRsZXIoKSB7XHJcbiAgICB2YXIgJGJvZHkgPSAkKGRvY3VtZW50LmJvZHkpLFxyXG4gICAgICAgIF90aGlzID0gdGhpcztcclxuICAgICRib2R5Lm9mZignbW91c2V1cC56Zi5kcm9wZG93bm1lbnUgdG91Y2hlbmQuemYuZHJvcGRvd25tZW51JylcclxuICAgICAgICAgLm9uKCdtb3VzZXVwLnpmLmRyb3Bkb3dubWVudSB0b3VjaGVuZC56Zi5kcm9wZG93bm1lbnUnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgICAgdmFyICRsaW5rID0gX3RoaXMuJGVsZW1lbnQuZmluZChlLnRhcmdldCk7XHJcbiAgICAgICAgICAgaWYgKCRsaW5rLmxlbmd0aCkgeyByZXR1cm47IH1cclxuXHJcbiAgICAgICAgICAgX3RoaXMuX2hpZGUoKTtcclxuICAgICAgICAgICAkYm9keS5vZmYoJ21vdXNldXAuemYuZHJvcGRvd25tZW51IHRvdWNoZW5kLnpmLmRyb3Bkb3dubWVudScpO1xyXG4gICAgICAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIE9wZW5zIGEgZHJvcGRvd24gcGFuZSwgYW5kIGNoZWNrcyBmb3IgY29sbGlzaW9ucyBmaXJzdC5cclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gJHN1YiAtIHVsIGVsZW1lbnQgdGhhdCBpcyBhIHN1Ym1lbnUgdG8gc2hvd1xyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICogQGZpcmVzIERyb3Bkb3duTWVudSNzaG93XHJcbiAgICovXHJcbiAgX3Nob3coJHN1Yikge1xyXG4gICAgdmFyIGlkeCA9IHRoaXMuJHRhYnMuaW5kZXgodGhpcy4kdGFicy5maWx0ZXIoZnVuY3Rpb24oaSwgZWwpIHtcclxuICAgICAgcmV0dXJuICQoZWwpLmZpbmQoJHN1YikubGVuZ3RoID4gMDtcclxuICAgIH0pKTtcclxuICAgIHZhciAkc2licyA9ICRzdWIucGFyZW50KCdsaS5pcy1kcm9wZG93bi1zdWJtZW51LXBhcmVudCcpLnNpYmxpbmdzKCdsaS5pcy1kcm9wZG93bi1zdWJtZW51LXBhcmVudCcpO1xyXG4gICAgdGhpcy5faGlkZSgkc2licywgaWR4KTtcclxuICAgICRzdWIuY3NzKCd2aXNpYmlsaXR5JywgJ2hpZGRlbicpLmFkZENsYXNzKCdqcy1kcm9wZG93bi1hY3RpdmUnKVxyXG4gICAgICAgIC5wYXJlbnQoJ2xpLmlzLWRyb3Bkb3duLXN1Ym1lbnUtcGFyZW50JykuYWRkQ2xhc3MoJ2lzLWFjdGl2ZScpO1xyXG4gICAgdmFyIGNsZWFyID0gRm91bmRhdGlvbi5Cb3guSW1Ob3RUb3VjaGluZ1lvdSgkc3ViLCBudWxsLCB0cnVlKTtcclxuICAgIGlmICghY2xlYXIpIHtcclxuICAgICAgdmFyIG9sZENsYXNzID0gdGhpcy5vcHRpb25zLmFsaWdubWVudCA9PT0gJ2xlZnQnID8gJy1yaWdodCcgOiAnLWxlZnQnLFxyXG4gICAgICAgICAgJHBhcmVudExpID0gJHN1Yi5wYXJlbnQoJy5pcy1kcm9wZG93bi1zdWJtZW51LXBhcmVudCcpO1xyXG4gICAgICAkcGFyZW50TGkucmVtb3ZlQ2xhc3MoYG9wZW5zJHtvbGRDbGFzc31gKS5hZGRDbGFzcyhgb3BlbnMtJHt0aGlzLm9wdGlvbnMuYWxpZ25tZW50fWApO1xyXG4gICAgICBjbGVhciA9IEZvdW5kYXRpb24uQm94LkltTm90VG91Y2hpbmdZb3UoJHN1YiwgbnVsbCwgdHJ1ZSk7XHJcbiAgICAgIGlmICghY2xlYXIpIHtcclxuICAgICAgICAkcGFyZW50TGkucmVtb3ZlQ2xhc3MoYG9wZW5zLSR7dGhpcy5vcHRpb25zLmFsaWdubWVudH1gKS5hZGRDbGFzcygnb3BlbnMtaW5uZXInKTtcclxuICAgICAgfVxyXG4gICAgICB0aGlzLmNoYW5nZWQgPSB0cnVlO1xyXG4gICAgfVxyXG4gICAgJHN1Yi5jc3MoJ3Zpc2liaWxpdHknLCAnJyk7XHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmNsb3NlT25DbGljaykgeyB0aGlzLl9hZGRCb2R5SGFuZGxlcigpOyB9XHJcbiAgICAvKipcclxuICAgICAqIEZpcmVzIHdoZW4gdGhlIG5ldyBkcm9wZG93biBwYW5lIGlzIHZpc2libGUuXHJcbiAgICAgKiBAZXZlbnQgRHJvcGRvd25NZW51I3Nob3dcclxuICAgICAqL1xyXG4gICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdzaG93LnpmLmRyb3Bkb3dubWVudScsIFskc3ViXSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIaWRlcyBhIHNpbmdsZSwgY3VycmVudGx5IG9wZW4gZHJvcGRvd24gcGFuZSwgaWYgcGFzc2VkIGEgcGFyYW1ldGVyLCBvdGhlcndpc2UsIGhpZGVzIGV2ZXJ5dGhpbmcuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHBhcmFtIHtqUXVlcnl9ICRlbGVtIC0gZWxlbWVudCB3aXRoIGEgc3VibWVudSB0byBoaWRlXHJcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGlkeCAtIGluZGV4IG9mIHRoZSAkdGFicyBjb2xsZWN0aW9uIHRvIGhpZGVcclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9oaWRlKCRlbGVtLCBpZHgpIHtcclxuICAgIHZhciAkdG9DbG9zZTtcclxuICAgIGlmICgkZWxlbSAmJiAkZWxlbS5sZW5ndGgpIHtcclxuICAgICAgJHRvQ2xvc2UgPSAkZWxlbTtcclxuICAgIH0gZWxzZSBpZiAoaWR4ICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgJHRvQ2xvc2UgPSB0aGlzLiR0YWJzLm5vdChmdW5jdGlvbihpLCBlbCkge1xyXG4gICAgICAgIHJldHVybiBpID09PSBpZHg7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgICR0b0Nsb3NlID0gdGhpcy4kZWxlbWVudDtcclxuICAgIH1cclxuICAgIHZhciBzb21ldGhpbmdUb0Nsb3NlID0gJHRvQ2xvc2UuaGFzQ2xhc3MoJ2lzLWFjdGl2ZScpIHx8ICR0b0Nsb3NlLmZpbmQoJy5pcy1hY3RpdmUnKS5sZW5ndGggPiAwO1xyXG5cclxuICAgIGlmIChzb21ldGhpbmdUb0Nsb3NlKSB7XHJcbiAgICAgICR0b0Nsb3NlLmZpbmQoJ2xpLmlzLWFjdGl2ZScpLmFkZCgkdG9DbG9zZSkuYXR0cih7XHJcbiAgICAgICAgJ2RhdGEtaXMtY2xpY2snOiBmYWxzZVxyXG4gICAgICB9KS5yZW1vdmVDbGFzcygnaXMtYWN0aXZlJyk7XHJcblxyXG4gICAgICAkdG9DbG9zZS5maW5kKCd1bC5qcy1kcm9wZG93bi1hY3RpdmUnKS5yZW1vdmVDbGFzcygnanMtZHJvcGRvd24tYWN0aXZlJyk7XHJcblxyXG4gICAgICBpZiAodGhpcy5jaGFuZ2VkIHx8ICR0b0Nsb3NlLmZpbmQoJ29wZW5zLWlubmVyJykubGVuZ3RoKSB7XHJcbiAgICAgICAgdmFyIG9sZENsYXNzID0gdGhpcy5vcHRpb25zLmFsaWdubWVudCA9PT0gJ2xlZnQnID8gJ3JpZ2h0JyA6ICdsZWZ0JztcclxuICAgICAgICAkdG9DbG9zZS5maW5kKCdsaS5pcy1kcm9wZG93bi1zdWJtZW51LXBhcmVudCcpLmFkZCgkdG9DbG9zZSlcclxuICAgICAgICAgICAgICAgIC5yZW1vdmVDbGFzcyhgb3BlbnMtaW5uZXIgb3BlbnMtJHt0aGlzLm9wdGlvbnMuYWxpZ25tZW50fWApXHJcbiAgICAgICAgICAgICAgICAuYWRkQ2xhc3MoYG9wZW5zLSR7b2xkQ2xhc3N9YCk7XHJcbiAgICAgICAgdGhpcy5jaGFuZ2VkID0gZmFsc2U7XHJcbiAgICAgIH1cclxuICAgICAgLyoqXHJcbiAgICAgICAqIEZpcmVzIHdoZW4gdGhlIG9wZW4gbWVudXMgYXJlIGNsb3NlZC5cclxuICAgICAgICogQGV2ZW50IERyb3Bkb3duTWVudSNoaWRlXHJcbiAgICAgICAqL1xyXG4gICAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ2hpZGUuemYuZHJvcGRvd25tZW51JywgWyR0b0Nsb3NlXSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZXN0cm95cyB0aGUgcGx1Z2luLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIGRlc3Ryb3koKSB7XHJcbiAgICB0aGlzLiRtZW51SXRlbXMub2ZmKCcuemYuZHJvcGRvd25tZW51JykucmVtb3ZlQXR0cignZGF0YS1pcy1jbGljaycpXHJcbiAgICAgICAgLnJlbW92ZUNsYXNzKCdpcy1yaWdodC1hcnJvdyBpcy1sZWZ0LWFycm93IGlzLWRvd24tYXJyb3cgb3BlbnMtcmlnaHQgb3BlbnMtbGVmdCBvcGVucy1pbm5lcicpO1xyXG4gICAgJChkb2N1bWVudC5ib2R5KS5vZmYoJy56Zi5kcm9wZG93bm1lbnUnKTtcclxuICAgIEZvdW5kYXRpb24uTmVzdC5CdXJuKHRoaXMuJGVsZW1lbnQsICdkcm9wZG93bicpO1xyXG4gICAgRm91bmRhdGlvbi51bnJlZ2lzdGVyUGx1Z2luKHRoaXMpO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIERlZmF1bHQgc2V0dGluZ3MgZm9yIHBsdWdpblxyXG4gKi9cclxuRHJvcGRvd25NZW51LmRlZmF1bHRzID0ge1xyXG4gIC8qKlxyXG4gICAqIERpc2FsbG93cyBob3ZlciBldmVudHMgZnJvbSBvcGVuaW5nIHN1Ym1lbnVzXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgZGlzYWJsZUhvdmVyOiBmYWxzZSxcclxuICAvKipcclxuICAgKiBBbGxvdyBhIHN1Ym1lbnUgdG8gYXV0b21hdGljYWxseSBjbG9zZSBvbiBhIG1vdXNlbGVhdmUgZXZlbnQsIGlmIG5vdCBjbGlja2VkIG9wZW4uXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIHRydWVcclxuICAgKi9cclxuICBhdXRvY2xvc2U6IHRydWUsXHJcbiAgLyoqXHJcbiAgICogQW1vdW50IG9mIHRpbWUgdG8gZGVsYXkgb3BlbmluZyBhIHN1Ym1lbnUgb24gaG92ZXIgZXZlbnQuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDUwXHJcbiAgICovXHJcbiAgaG92ZXJEZWxheTogNTAsXHJcbiAgLyoqXHJcbiAgICogQWxsb3cgYSBzdWJtZW51IHRvIG9wZW4vcmVtYWluIG9wZW4gb24gcGFyZW50IGNsaWNrIGV2ZW50LiBBbGxvd3MgY3Vyc29yIHRvIG1vdmUgYXdheSBmcm9tIG1lbnUuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIHRydWVcclxuICAgKi9cclxuICBjbGlja09wZW46IGZhbHNlLFxyXG4gIC8qKlxyXG4gICAqIEFtb3VudCBvZiB0aW1lIHRvIGRlbGF5IGNsb3NpbmcgYSBzdWJtZW51IG9uIGEgbW91c2VsZWF2ZSBldmVudC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgNTAwXHJcbiAgICovXHJcblxyXG4gIGNsb3NpbmdUaW1lOiA1MDAsXHJcbiAgLyoqXHJcbiAgICogUG9zaXRpb24gb2YgdGhlIG1lbnUgcmVsYXRpdmUgdG8gd2hhdCBkaXJlY3Rpb24gdGhlIHN1Ym1lbnVzIHNob3VsZCBvcGVuLiBIYW5kbGVkIGJ5IEpTLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnbGVmdCdcclxuICAgKi9cclxuICBhbGlnbm1lbnQ6ICdsZWZ0JyxcclxuICAvKipcclxuICAgKiBBbGxvdyBjbGlja3Mgb24gdGhlIGJvZHkgdG8gY2xvc2UgYW55IG9wZW4gc3VibWVudXMuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIHRydWVcclxuICAgKi9cclxuICBjbG9zZU9uQ2xpY2s6IHRydWUsXHJcbiAgLyoqXHJcbiAgICogQWxsb3cgY2xpY2tzIG9uIGxlYWYgYW5jaG9yIGxpbmtzIHRvIGNsb3NlIGFueSBvcGVuIHN1Ym1lbnVzLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSB0cnVlXHJcbiAgICovXHJcbiAgY2xvc2VPbkNsaWNrSW5zaWRlOiB0cnVlLFxyXG4gIC8qKlxyXG4gICAqIENsYXNzIGFwcGxpZWQgdG8gdmVydGljYWwgb3JpZW50ZWQgbWVudXMsIEZvdW5kYXRpb24gZGVmYXVsdCBpcyBgdmVydGljYWxgLiBVcGRhdGUgdGhpcyBpZiB1c2luZyB5b3VyIG93biBjbGFzcy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ3ZlcnRpY2FsJ1xyXG4gICAqL1xyXG4gIHZlcnRpY2FsQ2xhc3M6ICd2ZXJ0aWNhbCcsXHJcbiAgLyoqXHJcbiAgICogQ2xhc3MgYXBwbGllZCB0byByaWdodC1zaWRlIG9yaWVudGVkIG1lbnVzLCBGb3VuZGF0aW9uIGRlZmF1bHQgaXMgYGFsaWduLXJpZ2h0YC4gVXBkYXRlIHRoaXMgaWYgdXNpbmcgeW91ciBvd24gY2xhc3MuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICdhbGlnbi1yaWdodCdcclxuICAgKi9cclxuICByaWdodENsYXNzOiAnYWxpZ24tcmlnaHQnLFxyXG4gIC8qKlxyXG4gICAqIEJvb2xlYW4gdG8gZm9yY2Ugb3ZlcmlkZSB0aGUgY2xpY2tpbmcgb2YgbGlua3MgdG8gcGVyZm9ybSBkZWZhdWx0IGFjdGlvbiwgb24gc2Vjb25kIHRvdWNoIGV2ZW50IGZvciBtb2JpbGUuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgZm9yY2VGb2xsb3c6IHRydWVcclxufTtcclxuXHJcbi8vIFdpbmRvdyBleHBvcnRzXHJcbkZvdW5kYXRpb24ucGx1Z2luKERyb3Bkb3duTWVudSwgJ0Ryb3Bkb3duTWVudScpO1xyXG5cclxufShqUXVlcnkpO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG4hZnVuY3Rpb24oJCkge1xyXG5cclxuLyoqXHJcbiAqIEVxdWFsaXplciBtb2R1bGUuXHJcbiAqIEBtb2R1bGUgZm91bmRhdGlvbi5lcXVhbGl6ZXJcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5tZWRpYVF1ZXJ5XHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwudGltZXJBbmRJbWFnZUxvYWRlciBpZiBlcXVhbGl6ZXIgY29udGFpbnMgaW1hZ2VzXHJcbiAqL1xyXG5cclxuY2xhc3MgRXF1YWxpemVyIHtcclxuICAvKipcclxuICAgKiBDcmVhdGVzIGEgbmV3IGluc3RhbmNlIG9mIEVxdWFsaXplci5cclxuICAgKiBAY2xhc3NcclxuICAgKiBAZmlyZXMgRXF1YWxpemVyI2luaXRcclxuICAgKiBAcGFyYW0ge09iamVjdH0gZWxlbWVudCAtIGpRdWVyeSBvYmplY3QgdG8gYWRkIHRoZSB0cmlnZ2VyIHRvLlxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIC0gT3ZlcnJpZGVzIHRvIHRoZSBkZWZhdWx0IHBsdWdpbiBzZXR0aW5ncy5cclxuICAgKi9cclxuICBjb25zdHJ1Y3RvcihlbGVtZW50LCBvcHRpb25zKXtcclxuICAgIHRoaXMuJGVsZW1lbnQgPSBlbGVtZW50O1xyXG4gICAgdGhpcy5vcHRpb25zICA9ICQuZXh0ZW5kKHt9LCBFcXVhbGl6ZXIuZGVmYXVsdHMsIHRoaXMuJGVsZW1lbnQuZGF0YSgpLCBvcHRpb25zKTtcclxuXHJcbiAgICB0aGlzLl9pbml0KCk7XHJcblxyXG4gICAgRm91bmRhdGlvbi5yZWdpc3RlclBsdWdpbih0aGlzLCAnRXF1YWxpemVyJyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJbml0aWFsaXplcyB0aGUgRXF1YWxpemVyIHBsdWdpbiBhbmQgY2FsbHMgZnVuY3Rpb25zIHRvIGdldCBlcXVhbGl6ZXIgZnVuY3Rpb25pbmcgb24gbG9hZC5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9pbml0KCkge1xyXG4gICAgdmFyIGVxSWQgPSB0aGlzLiRlbGVtZW50LmF0dHIoJ2RhdGEtZXF1YWxpemVyJykgfHwgJyc7XHJcbiAgICB2YXIgJHdhdGNoZWQgPSB0aGlzLiRlbGVtZW50LmZpbmQoYFtkYXRhLWVxdWFsaXplci13YXRjaD1cIiR7ZXFJZH1cIl1gKTtcclxuXHJcbiAgICB0aGlzLiR3YXRjaGVkID0gJHdhdGNoZWQubGVuZ3RoID8gJHdhdGNoZWQgOiB0aGlzLiRlbGVtZW50LmZpbmQoJ1tkYXRhLWVxdWFsaXplci13YXRjaF0nKTtcclxuICAgIHRoaXMuJGVsZW1lbnQuYXR0cignZGF0YS1yZXNpemUnLCAoZXFJZCB8fCBGb3VuZGF0aW9uLkdldFlvRGlnaXRzKDYsICdlcScpKSk7XHJcblx0dGhpcy4kZWxlbWVudC5hdHRyKCdkYXRhLW11dGF0ZScsIChlcUlkIHx8IEZvdW5kYXRpb24uR2V0WW9EaWdpdHMoNiwgJ2VxJykpKTtcclxuXHJcbiAgICB0aGlzLmhhc05lc3RlZCA9IHRoaXMuJGVsZW1lbnQuZmluZCgnW2RhdGEtZXF1YWxpemVyXScpLmxlbmd0aCA+IDA7XHJcbiAgICB0aGlzLmlzTmVzdGVkID0gdGhpcy4kZWxlbWVudC5wYXJlbnRzVW50aWwoZG9jdW1lbnQuYm9keSwgJ1tkYXRhLWVxdWFsaXplcl0nKS5sZW5ndGggPiAwO1xyXG4gICAgdGhpcy5pc09uID0gZmFsc2U7XHJcbiAgICB0aGlzLl9iaW5kSGFuZGxlciA9IHtcclxuICAgICAgb25SZXNpemVNZUJvdW5kOiB0aGlzLl9vblJlc2l6ZU1lLmJpbmQodGhpcyksXHJcbiAgICAgIG9uUG9zdEVxdWFsaXplZEJvdW5kOiB0aGlzLl9vblBvc3RFcXVhbGl6ZWQuYmluZCh0aGlzKVxyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgaW1ncyA9IHRoaXMuJGVsZW1lbnQuZmluZCgnaW1nJyk7XHJcbiAgICB2YXIgdG9vU21hbGw7XHJcbiAgICBpZih0aGlzLm9wdGlvbnMuZXF1YWxpemVPbil7XHJcbiAgICAgIHRvb1NtYWxsID0gdGhpcy5fY2hlY2tNUSgpO1xyXG4gICAgICAkKHdpbmRvdykub24oJ2NoYW5nZWQuemYubWVkaWFxdWVyeScsIHRoaXMuX2NoZWNrTVEuYmluZCh0aGlzKSk7XHJcbiAgICB9ZWxzZXtcclxuICAgICAgdGhpcy5fZXZlbnRzKCk7XHJcbiAgICB9XHJcbiAgICBpZigodG9vU21hbGwgIT09IHVuZGVmaW5lZCAmJiB0b29TbWFsbCA9PT0gZmFsc2UpIHx8IHRvb1NtYWxsID09PSB1bmRlZmluZWQpe1xyXG4gICAgICBpZihpbWdzLmxlbmd0aCl7XHJcbiAgICAgICAgRm91bmRhdGlvbi5vbkltYWdlc0xvYWRlZChpbWdzLCB0aGlzLl9yZWZsb3cuYmluZCh0aGlzKSk7XHJcbiAgICAgIH1lbHNle1xyXG4gICAgICAgIHRoaXMuX3JlZmxvdygpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZW1vdmVzIGV2ZW50IGxpc3RlbmVycyBpZiB0aGUgYnJlYWtwb2ludCBpcyB0b28gc21hbGwuXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfcGF1c2VFdmVudHMoKSB7XHJcbiAgICB0aGlzLmlzT24gPSBmYWxzZTtcclxuICAgIHRoaXMuJGVsZW1lbnQub2ZmKHtcclxuICAgICAgJy56Zi5lcXVhbGl6ZXInOiB0aGlzLl9iaW5kSGFuZGxlci5vblBvc3RFcXVhbGl6ZWRCb3VuZCxcclxuICAgICAgJ3Jlc2l6ZW1lLnpmLnRyaWdnZXInOiB0aGlzLl9iaW5kSGFuZGxlci5vblJlc2l6ZU1lQm91bmQsXHJcblx0ICAnbXV0YXRlbWUuemYudHJpZ2dlcic6IHRoaXMuX2JpbmRIYW5kbGVyLm9uUmVzaXplTWVCb3VuZFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBmdW5jdGlvbiB0byBoYW5kbGUgJGVsZW1lbnRzIHJlc2l6ZW1lLnpmLnRyaWdnZXIsIHdpdGggYm91bmQgdGhpcyBvbiBfYmluZEhhbmRsZXIub25SZXNpemVNZUJvdW5kXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfb25SZXNpemVNZShlKSB7XHJcbiAgICB0aGlzLl9yZWZsb3coKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIGZ1bmN0aW9uIHRvIGhhbmRsZSAkZWxlbWVudHMgcG9zdGVxdWFsaXplZC56Zi5lcXVhbGl6ZXIsIHdpdGggYm91bmQgdGhpcyBvbiBfYmluZEhhbmRsZXIub25Qb3N0RXF1YWxpemVkQm91bmRcclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9vblBvc3RFcXVhbGl6ZWQoZSkge1xyXG4gICAgaWYoZS50YXJnZXQgIT09IHRoaXMuJGVsZW1lbnRbMF0peyB0aGlzLl9yZWZsb3coKTsgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbGl6ZXMgZXZlbnRzIGZvciBFcXVhbGl6ZXIuXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfZXZlbnRzKCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgIHRoaXMuX3BhdXNlRXZlbnRzKCk7XHJcbiAgICBpZih0aGlzLmhhc05lc3RlZCl7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQub24oJ3Bvc3RlcXVhbGl6ZWQuemYuZXF1YWxpemVyJywgdGhpcy5fYmluZEhhbmRsZXIub25Qb3N0RXF1YWxpemVkQm91bmQpO1xyXG4gICAgfWVsc2V7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQub24oJ3Jlc2l6ZW1lLnpmLnRyaWdnZXInLCB0aGlzLl9iaW5kSGFuZGxlci5vblJlc2l6ZU1lQm91bmQpO1xyXG5cdCAgdGhpcy4kZWxlbWVudC5vbignbXV0YXRlbWUuemYudHJpZ2dlcicsIHRoaXMuX2JpbmRIYW5kbGVyLm9uUmVzaXplTWVCb3VuZCk7XHJcbiAgICB9XHJcbiAgICB0aGlzLmlzT24gPSB0cnVlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2tzIHRoZSBjdXJyZW50IGJyZWFrcG9pbnQgdG8gdGhlIG1pbmltdW0gcmVxdWlyZWQgc2l6ZS5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9jaGVja01RKCkge1xyXG4gICAgdmFyIHRvb1NtYWxsID0gIUZvdW5kYXRpb24uTWVkaWFRdWVyeS5pcyh0aGlzLm9wdGlvbnMuZXF1YWxpemVPbik7XHJcbiAgICBpZih0b29TbWFsbCl7XHJcbiAgICAgIGlmKHRoaXMuaXNPbil7XHJcbiAgICAgICAgdGhpcy5fcGF1c2VFdmVudHMoKTtcclxuICAgICAgICB0aGlzLiR3YXRjaGVkLmNzcygnaGVpZ2h0JywgJ2F1dG8nKTtcclxuICAgICAgfVxyXG4gICAgfWVsc2V7XHJcbiAgICAgIGlmKCF0aGlzLmlzT24pe1xyXG4gICAgICAgIHRoaXMuX2V2ZW50cygpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdG9vU21hbGw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBIG5vb3AgdmVyc2lvbiBmb3IgdGhlIHBsdWdpblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2tpbGxzd2l0Y2goKSB7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDYWxscyBuZWNlc3NhcnkgZnVuY3Rpb25zIHRvIHVwZGF0ZSBFcXVhbGl6ZXIgdXBvbiBET00gY2hhbmdlXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfcmVmbG93KCkge1xyXG4gICAgaWYoIXRoaXMub3B0aW9ucy5lcXVhbGl6ZU9uU3RhY2spe1xyXG4gICAgICBpZih0aGlzLl9pc1N0YWNrZWQoKSl7XHJcbiAgICAgICAgdGhpcy4kd2F0Y2hlZC5jc3MoJ2hlaWdodCcsICdhdXRvJyk7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmVxdWFsaXplQnlSb3cpIHtcclxuICAgICAgdGhpcy5nZXRIZWlnaHRzQnlSb3codGhpcy5hcHBseUhlaWdodEJ5Um93LmJpbmQodGhpcykpO1xyXG4gICAgfWVsc2V7XHJcbiAgICAgIHRoaXMuZ2V0SGVpZ2h0cyh0aGlzLmFwcGx5SGVpZ2h0LmJpbmQodGhpcykpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogTWFudWFsbHkgZGV0ZXJtaW5lcyBpZiB0aGUgZmlyc3QgMiBlbGVtZW50cyBhcmUgKk5PVCogc3RhY2tlZC5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9pc1N0YWNrZWQoKSB7XHJcbiAgICBpZiAoIXRoaXMuJHdhdGNoZWRbMF0gfHwgIXRoaXMuJHdhdGNoZWRbMV0pIHtcclxuICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcy4kd2F0Y2hlZFswXS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS50b3AgIT09IHRoaXMuJHdhdGNoZWRbMV0uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkudG9wO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRmluZHMgdGhlIG91dGVyIGhlaWdodHMgb2YgY2hpbGRyZW4gY29udGFpbmVkIHdpdGhpbiBhbiBFcXVhbGl6ZXIgcGFyZW50IGFuZCByZXR1cm5zIHRoZW0gaW4gYW4gYXJyYXlcclxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYiAtIEEgbm9uLW9wdGlvbmFsIGNhbGxiYWNrIHRvIHJldHVybiB0aGUgaGVpZ2h0cyBhcnJheSB0by5cclxuICAgKiBAcmV0dXJucyB7QXJyYXl9IGhlaWdodHMgLSBBbiBhcnJheSBvZiBoZWlnaHRzIG9mIGNoaWxkcmVuIHdpdGhpbiBFcXVhbGl6ZXIgY29udGFpbmVyXHJcbiAgICovXHJcbiAgZ2V0SGVpZ2h0cyhjYikge1xyXG4gICAgdmFyIGhlaWdodHMgPSBbXTtcclxuICAgIGZvcih2YXIgaSA9IDAsIGxlbiA9IHRoaXMuJHdhdGNoZWQubGVuZ3RoOyBpIDwgbGVuOyBpKyspe1xyXG4gICAgICB0aGlzLiR3YXRjaGVkW2ldLnN0eWxlLmhlaWdodCA9ICdhdXRvJztcclxuICAgICAgaGVpZ2h0cy5wdXNoKHRoaXMuJHdhdGNoZWRbaV0ub2Zmc2V0SGVpZ2h0KTtcclxuICAgIH1cclxuICAgIGNiKGhlaWdodHMpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRmluZHMgdGhlIG91dGVyIGhlaWdodHMgb2YgY2hpbGRyZW4gY29udGFpbmVkIHdpdGhpbiBhbiBFcXVhbGl6ZXIgcGFyZW50IGFuZCByZXR1cm5zIHRoZW0gaW4gYW4gYXJyYXlcclxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYiAtIEEgbm9uLW9wdGlvbmFsIGNhbGxiYWNrIHRvIHJldHVybiB0aGUgaGVpZ2h0cyBhcnJheSB0by5cclxuICAgKiBAcmV0dXJucyB7QXJyYXl9IGdyb3VwcyAtIEFuIGFycmF5IG9mIGhlaWdodHMgb2YgY2hpbGRyZW4gd2l0aGluIEVxdWFsaXplciBjb250YWluZXIgZ3JvdXBlZCBieSByb3cgd2l0aCBlbGVtZW50LGhlaWdodCBhbmQgbWF4IGFzIGxhc3QgY2hpbGRcclxuICAgKi9cclxuICBnZXRIZWlnaHRzQnlSb3coY2IpIHtcclxuICAgIHZhciBsYXN0RWxUb3BPZmZzZXQgPSAodGhpcy4kd2F0Y2hlZC5sZW5ndGggPyB0aGlzLiR3YXRjaGVkLmZpcnN0KCkub2Zmc2V0KCkudG9wIDogMCksXHJcbiAgICAgICAgZ3JvdXBzID0gW10sXHJcbiAgICAgICAgZ3JvdXAgPSAwO1xyXG4gICAgLy9ncm91cCBieSBSb3dcclxuICAgIGdyb3Vwc1tncm91cF0gPSBbXTtcclxuICAgIGZvcih2YXIgaSA9IDAsIGxlbiA9IHRoaXMuJHdhdGNoZWQubGVuZ3RoOyBpIDwgbGVuOyBpKyspe1xyXG4gICAgICB0aGlzLiR3YXRjaGVkW2ldLnN0eWxlLmhlaWdodCA9ICdhdXRvJztcclxuICAgICAgLy9tYXliZSBjb3VsZCB1c2UgdGhpcy4kd2F0Y2hlZFtpXS5vZmZzZXRUb3BcclxuICAgICAgdmFyIGVsT2Zmc2V0VG9wID0gJCh0aGlzLiR3YXRjaGVkW2ldKS5vZmZzZXQoKS50b3A7XHJcbiAgICAgIGlmIChlbE9mZnNldFRvcCE9bGFzdEVsVG9wT2Zmc2V0KSB7XHJcbiAgICAgICAgZ3JvdXArKztcclxuICAgICAgICBncm91cHNbZ3JvdXBdID0gW107XHJcbiAgICAgICAgbGFzdEVsVG9wT2Zmc2V0PWVsT2Zmc2V0VG9wO1xyXG4gICAgICB9XHJcbiAgICAgIGdyb3Vwc1tncm91cF0ucHVzaChbdGhpcy4kd2F0Y2hlZFtpXSx0aGlzLiR3YXRjaGVkW2ldLm9mZnNldEhlaWdodF0pO1xyXG4gICAgfVxyXG5cclxuICAgIGZvciAodmFyIGogPSAwLCBsbiA9IGdyb3Vwcy5sZW5ndGg7IGogPCBsbjsgaisrKSB7XHJcbiAgICAgIHZhciBoZWlnaHRzID0gJChncm91cHNbal0pLm1hcChmdW5jdGlvbigpeyByZXR1cm4gdGhpc1sxXTsgfSkuZ2V0KCk7XHJcbiAgICAgIHZhciBtYXggICAgICAgICA9IE1hdGgubWF4LmFwcGx5KG51bGwsIGhlaWdodHMpO1xyXG4gICAgICBncm91cHNbal0ucHVzaChtYXgpO1xyXG4gICAgfVxyXG4gICAgY2IoZ3JvdXBzKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoYW5nZXMgdGhlIENTUyBoZWlnaHQgcHJvcGVydHkgb2YgZWFjaCBjaGlsZCBpbiBhbiBFcXVhbGl6ZXIgcGFyZW50IHRvIG1hdGNoIHRoZSB0YWxsZXN0XHJcbiAgICogQHBhcmFtIHthcnJheX0gaGVpZ2h0cyAtIEFuIGFycmF5IG9mIGhlaWdodHMgb2YgY2hpbGRyZW4gd2l0aGluIEVxdWFsaXplciBjb250YWluZXJcclxuICAgKiBAZmlyZXMgRXF1YWxpemVyI3ByZWVxdWFsaXplZFxyXG4gICAqIEBmaXJlcyBFcXVhbGl6ZXIjcG9zdGVxdWFsaXplZFxyXG4gICAqL1xyXG4gIGFwcGx5SGVpZ2h0KGhlaWdodHMpIHtcclxuICAgIHZhciBtYXggPSBNYXRoLm1heC5hcHBseShudWxsLCBoZWlnaHRzKTtcclxuICAgIC8qKlxyXG4gICAgICogRmlyZXMgYmVmb3JlIHRoZSBoZWlnaHRzIGFyZSBhcHBsaWVkXHJcbiAgICAgKiBAZXZlbnQgRXF1YWxpemVyI3ByZWVxdWFsaXplZFxyXG4gICAgICovXHJcbiAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ3ByZWVxdWFsaXplZC56Zi5lcXVhbGl6ZXInKTtcclxuXHJcbiAgICB0aGlzLiR3YXRjaGVkLmNzcygnaGVpZ2h0JywgbWF4KTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIEZpcmVzIHdoZW4gdGhlIGhlaWdodHMgaGF2ZSBiZWVuIGFwcGxpZWRcclxuICAgICAqIEBldmVudCBFcXVhbGl6ZXIjcG9zdGVxdWFsaXplZFxyXG4gICAgICovXHJcbiAgICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdwb3N0ZXF1YWxpemVkLnpmLmVxdWFsaXplcicpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hhbmdlcyB0aGUgQ1NTIGhlaWdodCBwcm9wZXJ0eSBvZiBlYWNoIGNoaWxkIGluIGFuIEVxdWFsaXplciBwYXJlbnQgdG8gbWF0Y2ggdGhlIHRhbGxlc3QgYnkgcm93XHJcbiAgICogQHBhcmFtIHthcnJheX0gZ3JvdXBzIC0gQW4gYXJyYXkgb2YgaGVpZ2h0cyBvZiBjaGlsZHJlbiB3aXRoaW4gRXF1YWxpemVyIGNvbnRhaW5lciBncm91cGVkIGJ5IHJvdyB3aXRoIGVsZW1lbnQsaGVpZ2h0IGFuZCBtYXggYXMgbGFzdCBjaGlsZFxyXG4gICAqIEBmaXJlcyBFcXVhbGl6ZXIjcHJlZXF1YWxpemVkXHJcbiAgICogQGZpcmVzIEVxdWFsaXplciNwcmVlcXVhbGl6ZWRyb3dcclxuICAgKiBAZmlyZXMgRXF1YWxpemVyI3Bvc3RlcXVhbGl6ZWRyb3dcclxuICAgKiBAZmlyZXMgRXF1YWxpemVyI3Bvc3RlcXVhbGl6ZWRcclxuICAgKi9cclxuICBhcHBseUhlaWdodEJ5Um93KGdyb3Vwcykge1xyXG4gICAgLyoqXHJcbiAgICAgKiBGaXJlcyBiZWZvcmUgdGhlIGhlaWdodHMgYXJlIGFwcGxpZWRcclxuICAgICAqL1xyXG4gICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdwcmVlcXVhbGl6ZWQuemYuZXF1YWxpemVyJyk7XHJcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gZ3JvdXBzLmxlbmd0aDsgaSA8IGxlbiA7IGkrKykge1xyXG4gICAgICB2YXIgZ3JvdXBzSUxlbmd0aCA9IGdyb3Vwc1tpXS5sZW5ndGgsXHJcbiAgICAgICAgICBtYXggPSBncm91cHNbaV1bZ3JvdXBzSUxlbmd0aCAtIDFdO1xyXG4gICAgICBpZiAoZ3JvdXBzSUxlbmd0aDw9Mikge1xyXG4gICAgICAgICQoZ3JvdXBzW2ldWzBdWzBdKS5jc3MoeydoZWlnaHQnOidhdXRvJ30pO1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcbiAgICAgIC8qKlxyXG4gICAgICAgICogRmlyZXMgYmVmb3JlIHRoZSBoZWlnaHRzIHBlciByb3cgYXJlIGFwcGxpZWRcclxuICAgICAgICAqIEBldmVudCBFcXVhbGl6ZXIjcHJlZXF1YWxpemVkcm93XHJcbiAgICAgICAgKi9cclxuICAgICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdwcmVlcXVhbGl6ZWRyb3cuemYuZXF1YWxpemVyJyk7XHJcbiAgICAgIGZvciAodmFyIGogPSAwLCBsZW5KID0gKGdyb3Vwc0lMZW5ndGgtMSk7IGogPCBsZW5KIDsgaisrKSB7XHJcbiAgICAgICAgJChncm91cHNbaV1bal1bMF0pLmNzcyh7J2hlaWdodCc6bWF4fSk7XHJcbiAgICAgIH1cclxuICAgICAgLyoqXHJcbiAgICAgICAgKiBGaXJlcyB3aGVuIHRoZSBoZWlnaHRzIHBlciByb3cgaGF2ZSBiZWVuIGFwcGxpZWRcclxuICAgICAgICAqIEBldmVudCBFcXVhbGl6ZXIjcG9zdGVxdWFsaXplZHJvd1xyXG4gICAgICAgICovXHJcbiAgICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcigncG9zdGVxdWFsaXplZHJvdy56Zi5lcXVhbGl6ZXInKTtcclxuICAgIH1cclxuICAgIC8qKlxyXG4gICAgICogRmlyZXMgd2hlbiB0aGUgaGVpZ2h0cyBoYXZlIGJlZW4gYXBwbGllZFxyXG4gICAgICovXHJcbiAgICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdwb3N0ZXF1YWxpemVkLnpmLmVxdWFsaXplcicpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVzdHJveXMgYW4gaW5zdGFuY2Ugb2YgRXF1YWxpemVyLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIGRlc3Ryb3koKSB7XHJcbiAgICB0aGlzLl9wYXVzZUV2ZW50cygpO1xyXG4gICAgdGhpcy4kd2F0Y2hlZC5jc3MoJ2hlaWdodCcsICdhdXRvJyk7XHJcblxyXG4gICAgRm91bmRhdGlvbi51bnJlZ2lzdGVyUGx1Z2luKHRoaXMpO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIERlZmF1bHQgc2V0dGluZ3MgZm9yIHBsdWdpblxyXG4gKi9cclxuRXF1YWxpemVyLmRlZmF1bHRzID0ge1xyXG4gIC8qKlxyXG4gICAqIEVuYWJsZSBoZWlnaHQgZXF1YWxpemF0aW9uIHdoZW4gc3RhY2tlZCBvbiBzbWFsbGVyIHNjcmVlbnMuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIHRydWVcclxuICAgKi9cclxuICBlcXVhbGl6ZU9uU3RhY2s6IGZhbHNlLFxyXG4gIC8qKlxyXG4gICAqIEVuYWJsZSBoZWlnaHQgZXF1YWxpemF0aW9uIHJvdyBieSByb3cuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgZXF1YWxpemVCeVJvdzogZmFsc2UsXHJcbiAgLyoqXHJcbiAgICogU3RyaW5nIHJlcHJlc2VudGluZyB0aGUgbWluaW11bSBicmVha3BvaW50IHNpemUgdGhlIHBsdWdpbiBzaG91bGQgZXF1YWxpemUgaGVpZ2h0cyBvbi5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ21lZGl1bSdcclxuICAgKi9cclxuICBlcXVhbGl6ZU9uOiAnJ1xyXG59O1xyXG5cclxuLy8gV2luZG93IGV4cG9ydHNcclxuRm91bmRhdGlvbi5wbHVnaW4oRXF1YWxpemVyLCAnRXF1YWxpemVyJyk7XHJcblxyXG59KGpRdWVyeSk7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbiFmdW5jdGlvbigkKSB7XHJcblxyXG4vKipcclxuICogSW50ZXJjaGFuZ2UgbW9kdWxlLlxyXG4gKiBAbW9kdWxlIGZvdW5kYXRpb24uaW50ZXJjaGFuZ2VcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5tZWRpYVF1ZXJ5XHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwudGltZXJBbmRJbWFnZUxvYWRlclxyXG4gKi9cclxuXHJcbmNsYXNzIEludGVyY2hhbmdlIHtcclxuICAvKipcclxuICAgKiBDcmVhdGVzIGEgbmV3IGluc3RhbmNlIG9mIEludGVyY2hhbmdlLlxyXG4gICAqIEBjbGFzc1xyXG4gICAqIEBmaXJlcyBJbnRlcmNoYW5nZSNpbml0XHJcbiAgICogQHBhcmFtIHtPYmplY3R9IGVsZW1lbnQgLSBqUXVlcnkgb2JqZWN0IHRvIGFkZCB0aGUgdHJpZ2dlciB0by5cclxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyAtIE92ZXJyaWRlcyB0byB0aGUgZGVmYXVsdCBwbHVnaW4gc2V0dGluZ3MuXHJcbiAgICovXHJcbiAgY29uc3RydWN0b3IoZWxlbWVudCwgb3B0aW9ucykge1xyXG4gICAgdGhpcy4kZWxlbWVudCA9IGVsZW1lbnQ7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgSW50ZXJjaGFuZ2UuZGVmYXVsdHMsIG9wdGlvbnMpO1xyXG4gICAgdGhpcy5ydWxlcyA9IFtdO1xyXG4gICAgdGhpcy5jdXJyZW50UGF0aCA9ICcnO1xyXG5cclxuICAgIHRoaXMuX2luaXQoKTtcclxuICAgIHRoaXMuX2V2ZW50cygpO1xyXG5cclxuICAgIEZvdW5kYXRpb24ucmVnaXN0ZXJQbHVnaW4odGhpcywgJ0ludGVyY2hhbmdlJyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJbml0aWFsaXplcyB0aGUgSW50ZXJjaGFuZ2UgcGx1Z2luIGFuZCBjYWxscyBmdW5jdGlvbnMgdG8gZ2V0IGludGVyY2hhbmdlIGZ1bmN0aW9uaW5nIG9uIGxvYWQuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfaW5pdCgpIHtcclxuICAgIHRoaXMuX2FkZEJyZWFrcG9pbnRzKCk7XHJcbiAgICB0aGlzLl9nZW5lcmF0ZVJ1bGVzKCk7XHJcbiAgICB0aGlzLl9yZWZsb3coKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEluaXRpYWxpemVzIGV2ZW50cyBmb3IgSW50ZXJjaGFuZ2UuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfZXZlbnRzKCkge1xyXG4gICAgJCh3aW5kb3cpLm9uKCdyZXNpemUuemYuaW50ZXJjaGFuZ2UnLCBGb3VuZGF0aW9uLnV0aWwudGhyb3R0bGUoKCkgPT4ge1xyXG4gICAgICB0aGlzLl9yZWZsb3coKTtcclxuICAgIH0sIDUwKSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDYWxscyBuZWNlc3NhcnkgZnVuY3Rpb25zIHRvIHVwZGF0ZSBJbnRlcmNoYW5nZSB1cG9uIERPTSBjaGFuZ2VcclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9yZWZsb3coKSB7XHJcbiAgICB2YXIgbWF0Y2g7XHJcblxyXG4gICAgLy8gSXRlcmF0ZSB0aHJvdWdoIGVhY2ggcnVsZSwgYnV0IG9ubHkgc2F2ZSB0aGUgbGFzdCBtYXRjaFxyXG4gICAgZm9yICh2YXIgaSBpbiB0aGlzLnJ1bGVzKSB7XHJcbiAgICAgIGlmKHRoaXMucnVsZXMuaGFzT3duUHJvcGVydHkoaSkpIHtcclxuICAgICAgICB2YXIgcnVsZSA9IHRoaXMucnVsZXNbaV07XHJcbiAgICAgICAgaWYgKHdpbmRvdy5tYXRjaE1lZGlhKHJ1bGUucXVlcnkpLm1hdGNoZXMpIHtcclxuICAgICAgICAgIG1hdGNoID0gcnVsZTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBpZiAobWF0Y2gpIHtcclxuICAgICAgdGhpcy5yZXBsYWNlKG1hdGNoLnBhdGgpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0cyB0aGUgRm91bmRhdGlvbiBicmVha3BvaW50cyBhbmQgYWRkcyB0aGVtIHRvIHRoZSBJbnRlcmNoYW5nZS5TUEVDSUFMX1FVRVJJRVMgb2JqZWN0LlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2FkZEJyZWFrcG9pbnRzKCkge1xyXG4gICAgZm9yICh2YXIgaSBpbiBGb3VuZGF0aW9uLk1lZGlhUXVlcnkucXVlcmllcykge1xyXG4gICAgICBpZiAoRm91bmRhdGlvbi5NZWRpYVF1ZXJ5LnF1ZXJpZXMuaGFzT3duUHJvcGVydHkoaSkpIHtcclxuICAgICAgICB2YXIgcXVlcnkgPSBGb3VuZGF0aW9uLk1lZGlhUXVlcnkucXVlcmllc1tpXTtcclxuICAgICAgICBJbnRlcmNoYW5nZS5TUEVDSUFMX1FVRVJJRVNbcXVlcnkubmFtZV0gPSBxdWVyeS52YWx1ZTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2tzIHRoZSBJbnRlcmNoYW5nZSBlbGVtZW50IGZvciB0aGUgcHJvdmlkZWQgbWVkaWEgcXVlcnkgKyBjb250ZW50IHBhaXJpbmdzXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKiBAcGFyYW0ge09iamVjdH0gZWxlbWVudCAtIGpRdWVyeSBvYmplY3QgdGhhdCBpcyBhbiBJbnRlcmNoYW5nZSBpbnN0YW5jZVxyXG4gICAqIEByZXR1cm5zIHtBcnJheX0gc2NlbmFyaW9zIC0gQXJyYXkgb2Ygb2JqZWN0cyB0aGF0IGhhdmUgJ21xJyBhbmQgJ3BhdGgnIGtleXMgd2l0aCBjb3JyZXNwb25kaW5nIGtleXNcclxuICAgKi9cclxuICBfZ2VuZXJhdGVSdWxlcyhlbGVtZW50KSB7XHJcbiAgICB2YXIgcnVsZXNMaXN0ID0gW107XHJcbiAgICB2YXIgcnVsZXM7XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5ydWxlcykge1xyXG4gICAgICBydWxlcyA9IHRoaXMub3B0aW9ucy5ydWxlcztcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICBydWxlcyA9IHRoaXMuJGVsZW1lbnQuZGF0YSgnaW50ZXJjaGFuZ2UnKS5tYXRjaCgvXFxbLio/XFxdL2cpO1xyXG4gICAgfVxyXG5cclxuICAgIGZvciAodmFyIGkgaW4gcnVsZXMpIHtcclxuICAgICAgaWYocnVsZXMuaGFzT3duUHJvcGVydHkoaSkpIHtcclxuICAgICAgICB2YXIgcnVsZSA9IHJ1bGVzW2ldLnNsaWNlKDEsIC0xKS5zcGxpdCgnLCAnKTtcclxuICAgICAgICB2YXIgcGF0aCA9IHJ1bGUuc2xpY2UoMCwgLTEpLmpvaW4oJycpO1xyXG4gICAgICAgIHZhciBxdWVyeSA9IHJ1bGVbcnVsZS5sZW5ndGggLSAxXTtcclxuXHJcbiAgICAgICAgaWYgKEludGVyY2hhbmdlLlNQRUNJQUxfUVVFUklFU1txdWVyeV0pIHtcclxuICAgICAgICAgIHF1ZXJ5ID0gSW50ZXJjaGFuZ2UuU1BFQ0lBTF9RVUVSSUVTW3F1ZXJ5XTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJ1bGVzTGlzdC5wdXNoKHtcclxuICAgICAgICAgIHBhdGg6IHBhdGgsXHJcbiAgICAgICAgICBxdWVyeTogcXVlcnlcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHRoaXMucnVsZXMgPSBydWxlc0xpc3Q7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVcGRhdGUgdGhlIGBzcmNgIHByb3BlcnR5IG9mIGFuIGltYWdlLCBvciBjaGFuZ2UgdGhlIEhUTUwgb2YgYSBjb250YWluZXIsIHRvIHRoZSBzcGVjaWZpZWQgcGF0aC5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcGFyYW0ge1N0cmluZ30gcGF0aCAtIFBhdGggdG8gdGhlIGltYWdlIG9yIEhUTUwgcGFydGlhbC5cclxuICAgKiBAZmlyZXMgSW50ZXJjaGFuZ2UjcmVwbGFjZWRcclxuICAgKi9cclxuICByZXBsYWNlKHBhdGgpIHtcclxuICAgIGlmICh0aGlzLmN1cnJlbnRQYXRoID09PSBwYXRoKSByZXR1cm47XHJcblxyXG4gICAgdmFyIF90aGlzID0gdGhpcyxcclxuICAgICAgICB0cmlnZ2VyID0gJ3JlcGxhY2VkLnpmLmludGVyY2hhbmdlJztcclxuXHJcbiAgICAvLyBSZXBsYWNpbmcgaW1hZ2VzXHJcbiAgICBpZiAodGhpcy4kZWxlbWVudFswXS5ub2RlTmFtZSA9PT0gJ0lNRycpIHtcclxuICAgICAgdGhpcy4kZWxlbWVudC5hdHRyKCdzcmMnLCBwYXRoKS5vbignbG9hZCcsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIF90aGlzLmN1cnJlbnRQYXRoID0gcGF0aDtcclxuICAgICAgfSlcclxuICAgICAgLnRyaWdnZXIodHJpZ2dlcik7XHJcbiAgICB9XHJcbiAgICAvLyBSZXBsYWNpbmcgYmFja2dyb3VuZCBpbWFnZXNcclxuICAgIGVsc2UgaWYgKHBhdGgubWF0Y2goL1xcLihnaWZ8anBnfGpwZWd8cG5nfHN2Z3x0aWZmKShbPyNdLiopPy9pKSkge1xyXG4gICAgICB0aGlzLiRlbGVtZW50LmNzcyh7ICdiYWNrZ3JvdW5kLWltYWdlJzogJ3VybCgnK3BhdGgrJyknIH0pXHJcbiAgICAgICAgICAudHJpZ2dlcih0cmlnZ2VyKTtcclxuICAgIH1cclxuICAgIC8vIFJlcGxhY2luZyBIVE1MXHJcbiAgICBlbHNlIHtcclxuICAgICAgJC5nZXQocGF0aCwgZnVuY3Rpb24ocmVzcG9uc2UpIHtcclxuICAgICAgICBfdGhpcy4kZWxlbWVudC5odG1sKHJlc3BvbnNlKVxyXG4gICAgICAgICAgICAgLnRyaWdnZXIodHJpZ2dlcik7XHJcbiAgICAgICAgJChyZXNwb25zZSkuZm91bmRhdGlvbigpO1xyXG4gICAgICAgIF90aGlzLmN1cnJlbnRQYXRoID0gcGF0aDtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGaXJlcyB3aGVuIGNvbnRlbnQgaW4gYW4gSW50ZXJjaGFuZ2UgZWxlbWVudCBpcyBkb25lIGJlaW5nIGxvYWRlZC5cclxuICAgICAqIEBldmVudCBJbnRlcmNoYW5nZSNyZXBsYWNlZFxyXG4gICAgICovXHJcbiAgICAvLyB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ3JlcGxhY2VkLnpmLmludGVyY2hhbmdlJyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZXN0cm95cyBhbiBpbnN0YW5jZSBvZiBpbnRlcmNoYW5nZS5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICBkZXN0cm95KCkge1xyXG4gICAgLy9UT0RPIHRoaXMuXHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogRGVmYXVsdCBzZXR0aW5ncyBmb3IgcGx1Z2luXHJcbiAqL1xyXG5JbnRlcmNoYW5nZS5kZWZhdWx0cyA9IHtcclxuICAvKipcclxuICAgKiBSdWxlcyB0byBiZSBhcHBsaWVkIHRvIEludGVyY2hhbmdlIGVsZW1lbnRzLiBTZXQgd2l0aCB0aGUgYGRhdGEtaW50ZXJjaGFuZ2VgIGFycmF5IG5vdGF0aW9uLlxyXG4gICAqIEBvcHRpb25cclxuICAgKi9cclxuICBydWxlczogbnVsbFxyXG59O1xyXG5cclxuSW50ZXJjaGFuZ2UuU1BFQ0lBTF9RVUVSSUVTID0ge1xyXG4gICdsYW5kc2NhcGUnOiAnc2NyZWVuIGFuZCAob3JpZW50YXRpb246IGxhbmRzY2FwZSknLFxyXG4gICdwb3J0cmFpdCc6ICdzY3JlZW4gYW5kIChvcmllbnRhdGlvbjogcG9ydHJhaXQpJyxcclxuICAncmV0aW5hJzogJ29ubHkgc2NyZWVuIGFuZCAoLXdlYmtpdC1taW4tZGV2aWNlLXBpeGVsLXJhdGlvOiAyKSwgb25seSBzY3JlZW4gYW5kIChtaW4tLW1vei1kZXZpY2UtcGl4ZWwtcmF0aW86IDIpLCBvbmx5IHNjcmVlbiBhbmQgKC1vLW1pbi1kZXZpY2UtcGl4ZWwtcmF0aW86IDIvMSksIG9ubHkgc2NyZWVuIGFuZCAobWluLWRldmljZS1waXhlbC1yYXRpbzogMiksIG9ubHkgc2NyZWVuIGFuZCAobWluLXJlc29sdXRpb246IDE5MmRwaSksIG9ubHkgc2NyZWVuIGFuZCAobWluLXJlc29sdXRpb246IDJkcHB4KSdcclxufTtcclxuXHJcbi8vIFdpbmRvdyBleHBvcnRzXHJcbkZvdW5kYXRpb24ucGx1Z2luKEludGVyY2hhbmdlLCAnSW50ZXJjaGFuZ2UnKTtcclxuXHJcbn0oalF1ZXJ5KTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuIWZ1bmN0aW9uKCQpIHtcclxuXHJcbi8qKlxyXG4gKiBNYWdlbGxhbiBtb2R1bGUuXHJcbiAqIEBtb2R1bGUgZm91bmRhdGlvbi5tYWdlbGxhblxyXG4gKi9cclxuXHJcbmNsYXNzIE1hZ2VsbGFuIHtcclxuICAvKipcclxuICAgKiBDcmVhdGVzIGEgbmV3IGluc3RhbmNlIG9mIE1hZ2VsbGFuLlxyXG4gICAqIEBjbGFzc1xyXG4gICAqIEBmaXJlcyBNYWdlbGxhbiNpbml0XHJcbiAgICogQHBhcmFtIHtPYmplY3R9IGVsZW1lbnQgLSBqUXVlcnkgb2JqZWN0IHRvIGFkZCB0aGUgdHJpZ2dlciB0by5cclxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyAtIE92ZXJyaWRlcyB0byB0aGUgZGVmYXVsdCBwbHVnaW4gc2V0dGluZ3MuXHJcbiAgICovXHJcbiAgY29uc3RydWN0b3IoZWxlbWVudCwgb3B0aW9ucykge1xyXG4gICAgdGhpcy4kZWxlbWVudCA9IGVsZW1lbnQ7XHJcbiAgICB0aGlzLm9wdGlvbnMgID0gJC5leHRlbmQoe30sIE1hZ2VsbGFuLmRlZmF1bHRzLCB0aGlzLiRlbGVtZW50LmRhdGEoKSwgb3B0aW9ucyk7XHJcblxyXG4gICAgdGhpcy5faW5pdCgpO1xyXG4gICAgdGhpcy5jYWxjUG9pbnRzKCk7XHJcblxyXG4gICAgRm91bmRhdGlvbi5yZWdpc3RlclBsdWdpbih0aGlzLCAnTWFnZWxsYW4nKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEluaXRpYWxpemVzIHRoZSBNYWdlbGxhbiBwbHVnaW4gYW5kIGNhbGxzIGZ1bmN0aW9ucyB0byBnZXQgZXF1YWxpemVyIGZ1bmN0aW9uaW5nIG9uIGxvYWQuXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfaW5pdCgpIHtcclxuICAgIHZhciBpZCA9IHRoaXMuJGVsZW1lbnRbMF0uaWQgfHwgRm91bmRhdGlvbi5HZXRZb0RpZ2l0cyg2LCAnbWFnZWxsYW4nKTtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICB0aGlzLiR0YXJnZXRzID0gJCgnW2RhdGEtbWFnZWxsYW4tdGFyZ2V0XScpO1xyXG4gICAgdGhpcy4kbGlua3MgPSB0aGlzLiRlbGVtZW50LmZpbmQoJ2EnKTtcclxuICAgIHRoaXMuJGVsZW1lbnQuYXR0cih7XHJcbiAgICAgICdkYXRhLXJlc2l6ZSc6IGlkLFxyXG4gICAgICAnZGF0YS1zY3JvbGwnOiBpZCxcclxuICAgICAgJ2lkJzogaWRcclxuICAgIH0pO1xyXG4gICAgdGhpcy4kYWN0aXZlID0gJCgpO1xyXG4gICAgdGhpcy5zY3JvbGxQb3MgPSBwYXJzZUludCh3aW5kb3cucGFnZVlPZmZzZXQsIDEwKTtcclxuXHJcbiAgICB0aGlzLl9ldmVudHMoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENhbGN1bGF0ZXMgYW4gYXJyYXkgb2YgcGl4ZWwgdmFsdWVzIHRoYXQgYXJlIHRoZSBkZW1hcmNhdGlvbiBsaW5lcyBiZXR3ZWVuIGxvY2F0aW9ucyBvbiB0aGUgcGFnZS5cclxuICAgKiBDYW4gYmUgaW52b2tlZCBpZiBuZXcgZWxlbWVudHMgYXJlIGFkZGVkIG9yIHRoZSBzaXplIG9mIGEgbG9jYXRpb24gY2hhbmdlcy5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICBjYWxjUG9pbnRzKCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcyxcclxuICAgICAgICBib2R5ID0gZG9jdW1lbnQuYm9keSxcclxuICAgICAgICBodG1sID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50O1xyXG5cclxuICAgIHRoaXMucG9pbnRzID0gW107XHJcbiAgICB0aGlzLndpbkhlaWdodCA9IE1hdGgucm91bmQoTWF0aC5tYXgod2luZG93LmlubmVySGVpZ2h0LCBodG1sLmNsaWVudEhlaWdodCkpO1xyXG4gICAgdGhpcy5kb2NIZWlnaHQgPSBNYXRoLnJvdW5kKE1hdGgubWF4KGJvZHkuc2Nyb2xsSGVpZ2h0LCBib2R5Lm9mZnNldEhlaWdodCwgaHRtbC5jbGllbnRIZWlnaHQsIGh0bWwuc2Nyb2xsSGVpZ2h0LCBodG1sLm9mZnNldEhlaWdodCkpO1xyXG5cclxuICAgIHRoaXMuJHRhcmdldHMuZWFjaChmdW5jdGlvbigpe1xyXG4gICAgICB2YXIgJHRhciA9ICQodGhpcyksXHJcbiAgICAgICAgICBwdCA9IE1hdGgucm91bmQoJHRhci5vZmZzZXQoKS50b3AgLSBfdGhpcy5vcHRpb25zLnRocmVzaG9sZCk7XHJcbiAgICAgICR0YXIudGFyZ2V0UG9pbnQgPSBwdDtcclxuICAgICAgX3RoaXMucG9pbnRzLnB1c2gocHQpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJbml0aWFsaXplcyBldmVudHMgZm9yIE1hZ2VsbGFuLlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2V2ZW50cygpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXMsXHJcbiAgICAgICAgJGJvZHkgPSAkKCdodG1sLCBib2R5JyksXHJcbiAgICAgICAgb3B0cyA9IHtcclxuICAgICAgICAgIGR1cmF0aW9uOiBfdGhpcy5vcHRpb25zLmFuaW1hdGlvbkR1cmF0aW9uLFxyXG4gICAgICAgICAgZWFzaW5nOiAgIF90aGlzLm9wdGlvbnMuYW5pbWF0aW9uRWFzaW5nXHJcbiAgICAgICAgfTtcclxuICAgICQod2luZG93KS5vbmUoJ2xvYWQnLCBmdW5jdGlvbigpe1xyXG4gICAgICBpZihfdGhpcy5vcHRpb25zLmRlZXBMaW5raW5nKXtcclxuICAgICAgICBpZihsb2NhdGlvbi5oYXNoKXtcclxuICAgICAgICAgIF90aGlzLnNjcm9sbFRvTG9jKGxvY2F0aW9uLmhhc2gpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBfdGhpcy5jYWxjUG9pbnRzKCk7XHJcbiAgICAgIF90aGlzLl91cGRhdGVBY3RpdmUoKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuJGVsZW1lbnQub24oe1xyXG4gICAgICAncmVzaXplbWUuemYudHJpZ2dlcic6IHRoaXMucmVmbG93LmJpbmQodGhpcyksXHJcbiAgICAgICdzY3JvbGxtZS56Zi50cmlnZ2VyJzogdGhpcy5fdXBkYXRlQWN0aXZlLmJpbmQodGhpcylcclxuICAgIH0pLm9uKCdjbGljay56Zi5tYWdlbGxhbicsICdhW2hyZWZePVwiI1wiXScsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgdmFyIGFycml2YWwgICA9IHRoaXMuZ2V0QXR0cmlidXRlKCdocmVmJyk7XHJcbiAgICAgICAgX3RoaXMuc2Nyb2xsVG9Mb2MoYXJyaXZhbCk7XHJcbiAgICAgIH0pO1xyXG4gICAgJCh3aW5kb3cpLm9uKCdwb3BzdGF0ZScsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgaWYoX3RoaXMub3B0aW9ucy5kZWVwTGlua2luZykge1xyXG4gICAgICAgIF90aGlzLnNjcm9sbFRvTG9jKHdpbmRvdy5sb2NhdGlvbi5oYXNoKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBGdW5jdGlvbiB0byBzY3JvbGwgdG8gYSBnaXZlbiBsb2NhdGlvbiBvbiB0aGUgcGFnZS5cclxuICAgKiBAcGFyYW0ge1N0cmluZ30gbG9jIC0gYSBwcm9wZXJseSBmb3JtYXR0ZWQgalF1ZXJ5IGlkIHNlbGVjdG9yLiBFeGFtcGxlOiAnI2ZvbydcclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICBzY3JvbGxUb0xvYyhsb2MpIHtcclxuICAgIC8vIERvIG5vdGhpbmcgaWYgdGFyZ2V0IGRvZXMgbm90IGV4aXN0IHRvIHByZXZlbnQgZXJyb3JzXHJcbiAgICBpZiAoISQobG9jKS5sZW5ndGgpIHtyZXR1cm4gZmFsc2U7fVxyXG4gICAgdGhpcy5faW5UcmFuc2l0aW9uID0gdHJ1ZTtcclxuICAgIHZhciBfdGhpcyA9IHRoaXMsXHJcbiAgICAgICAgc2Nyb2xsUG9zID0gTWF0aC5yb3VuZCgkKGxvYykub2Zmc2V0KCkudG9wIC0gdGhpcy5vcHRpb25zLnRocmVzaG9sZCAvIDIgLSB0aGlzLm9wdGlvbnMuYmFyT2Zmc2V0KTtcclxuXHJcbiAgICAkKCdodG1sLCBib2R5Jykuc3RvcCh0cnVlKS5hbmltYXRlKFxyXG4gICAgICB7IHNjcm9sbFRvcDogc2Nyb2xsUG9zIH0sXHJcbiAgICAgIHRoaXMub3B0aW9ucy5hbmltYXRpb25EdXJhdGlvbixcclxuICAgICAgdGhpcy5vcHRpb25zLmFuaW1hdGlvbkVhc2luZyxcclxuICAgICAgZnVuY3Rpb24oKSB7X3RoaXMuX2luVHJhbnNpdGlvbiA9IGZhbHNlOyBfdGhpcy5fdXBkYXRlQWN0aXZlKCl9XHJcbiAgICApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2FsbHMgbmVjZXNzYXJ5IGZ1bmN0aW9ucyB0byB1cGRhdGUgTWFnZWxsYW4gdXBvbiBET00gY2hhbmdlXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgcmVmbG93KCkge1xyXG4gICAgdGhpcy5jYWxjUG9pbnRzKCk7XHJcbiAgICB0aGlzLl91cGRhdGVBY3RpdmUoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFVwZGF0ZXMgdGhlIHZpc2liaWxpdHkgb2YgYW4gYWN0aXZlIGxvY2F0aW9uIGxpbmssIGFuZCB1cGRhdGVzIHRoZSB1cmwgaGFzaCBmb3IgdGhlIHBhZ2UsIGlmIGRlZXBMaW5raW5nIGVuYWJsZWQuXHJcbiAgICogQHByaXZhdGVcclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAZmlyZXMgTWFnZWxsYW4jdXBkYXRlXHJcbiAgICovXHJcbiAgX3VwZGF0ZUFjdGl2ZSgvKmV2dCwgZWxlbSwgc2Nyb2xsUG9zKi8pIHtcclxuICAgIGlmKHRoaXMuX2luVHJhbnNpdGlvbikge3JldHVybjt9XHJcbiAgICB2YXIgd2luUG9zID0gLypzY3JvbGxQb3MgfHwqLyBwYXJzZUludCh3aW5kb3cucGFnZVlPZmZzZXQsIDEwKSxcclxuICAgICAgICBjdXJJZHg7XHJcblxyXG4gICAgaWYod2luUG9zICsgdGhpcy53aW5IZWlnaHQgPT09IHRoaXMuZG9jSGVpZ2h0KXsgY3VySWR4ID0gdGhpcy5wb2ludHMubGVuZ3RoIC0gMTsgfVxyXG4gICAgZWxzZSBpZih3aW5Qb3MgPCB0aGlzLnBvaW50c1swXSl7IGN1cklkeCA9IHVuZGVmaW5lZDsgfVxyXG4gICAgZWxzZXtcclxuICAgICAgdmFyIGlzRG93biA9IHRoaXMuc2Nyb2xsUG9zIDwgd2luUG9zLFxyXG4gICAgICAgICAgX3RoaXMgPSB0aGlzLFxyXG4gICAgICAgICAgY3VyVmlzaWJsZSA9IHRoaXMucG9pbnRzLmZpbHRlcihmdW5jdGlvbihwLCBpKXtcclxuICAgICAgICAgICAgcmV0dXJuIGlzRG93biA/IHAgLSBfdGhpcy5vcHRpb25zLmJhck9mZnNldCA8PSB3aW5Qb3MgOiBwIC0gX3RoaXMub3B0aW9ucy5iYXJPZmZzZXQgLSBfdGhpcy5vcHRpb25zLnRocmVzaG9sZCA8PSB3aW5Qb3M7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgY3VySWR4ID0gY3VyVmlzaWJsZS5sZW5ndGggPyBjdXJWaXNpYmxlLmxlbmd0aCAtIDEgOiAwO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuJGFjdGl2ZS5yZW1vdmVDbGFzcyh0aGlzLm9wdGlvbnMuYWN0aXZlQ2xhc3MpO1xyXG4gICAgdGhpcy4kYWN0aXZlID0gdGhpcy4kbGlua3MuZmlsdGVyKCdbaHJlZj1cIiMnICsgdGhpcy4kdGFyZ2V0cy5lcShjdXJJZHgpLmRhdGEoJ21hZ2VsbGFuLXRhcmdldCcpICsgJ1wiXScpLmFkZENsYXNzKHRoaXMub3B0aW9ucy5hY3RpdmVDbGFzcyk7XHJcblxyXG4gICAgaWYodGhpcy5vcHRpb25zLmRlZXBMaW5raW5nKXtcclxuICAgICAgdmFyIGhhc2ggPSBcIlwiO1xyXG4gICAgICBpZihjdXJJZHggIT0gdW5kZWZpbmVkKXtcclxuICAgICAgICBoYXNoID0gdGhpcy4kYWN0aXZlWzBdLmdldEF0dHJpYnV0ZSgnaHJlZicpO1xyXG4gICAgICB9XHJcbiAgICAgIGlmKGhhc2ggIT09IHdpbmRvdy5sb2NhdGlvbi5oYXNoKSB7XHJcbiAgICAgICAgaWYod2luZG93Lmhpc3RvcnkucHVzaFN0YXRlKXtcclxuICAgICAgICAgIHdpbmRvdy5oaXN0b3J5LnB1c2hTdGF0ZShudWxsLCBudWxsLCBoYXNoKTtcclxuICAgICAgICB9ZWxzZXtcclxuICAgICAgICAgIHdpbmRvdy5sb2NhdGlvbi5oYXNoID0gaGFzaDtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICB0aGlzLnNjcm9sbFBvcyA9IHdpblBvcztcclxuICAgIC8qKlxyXG4gICAgICogRmlyZXMgd2hlbiBtYWdlbGxhbiBpcyBmaW5pc2hlZCB1cGRhdGluZyB0byB0aGUgbmV3IGFjdGl2ZSBlbGVtZW50LlxyXG4gICAgICogQGV2ZW50IE1hZ2VsbGFuI3VwZGF0ZVxyXG4gICAgICovXHJcbiAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ3VwZGF0ZS56Zi5tYWdlbGxhbicsIFt0aGlzLiRhY3RpdmVdKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlc3Ryb3lzIGFuIGluc3RhbmNlIG9mIE1hZ2VsbGFuIGFuZCByZXNldHMgdGhlIHVybCBvZiB0aGUgd2luZG93LlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIGRlc3Ryb3koKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50Lm9mZignLnpmLnRyaWdnZXIgLnpmLm1hZ2VsbGFuJylcclxuICAgICAgICAuZmluZChgLiR7dGhpcy5vcHRpb25zLmFjdGl2ZUNsYXNzfWApLnJlbW92ZUNsYXNzKHRoaXMub3B0aW9ucy5hY3RpdmVDbGFzcyk7XHJcblxyXG4gICAgaWYodGhpcy5vcHRpb25zLmRlZXBMaW5raW5nKXtcclxuICAgICAgdmFyIGhhc2ggPSB0aGlzLiRhY3RpdmVbMF0uZ2V0QXR0cmlidXRlKCdocmVmJyk7XHJcbiAgICAgIHdpbmRvdy5sb2NhdGlvbi5oYXNoLnJlcGxhY2UoaGFzaCwgJycpO1xyXG4gICAgfVxyXG5cclxuICAgIEZvdW5kYXRpb24udW5yZWdpc3RlclBsdWdpbih0aGlzKTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBEZWZhdWx0IHNldHRpbmdzIGZvciBwbHVnaW5cclxuICovXHJcbk1hZ2VsbGFuLmRlZmF1bHRzID0ge1xyXG4gIC8qKlxyXG4gICAqIEFtb3VudCBvZiB0aW1lLCBpbiBtcywgdGhlIGFuaW1hdGVkIHNjcm9sbGluZyBzaG91bGQgdGFrZSBiZXR3ZWVuIGxvY2F0aW9ucy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgNTAwXHJcbiAgICovXHJcbiAgYW5pbWF0aW9uRHVyYXRpb246IDUwMCxcclxuICAvKipcclxuICAgKiBBbmltYXRpb24gc3R5bGUgdG8gdXNlIHdoZW4gc2Nyb2xsaW5nIGJldHdlZW4gbG9jYXRpb25zLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnZWFzZS1pbi1vdXQnXHJcbiAgICovXHJcbiAgYW5pbWF0aW9uRWFzaW5nOiAnbGluZWFyJyxcclxuICAvKipcclxuICAgKiBOdW1iZXIgb2YgcGl4ZWxzIHRvIHVzZSBhcyBhIG1hcmtlciBmb3IgbG9jYXRpb24gY2hhbmdlcy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgNTBcclxuICAgKi9cclxuICB0aHJlc2hvbGQ6IDUwLFxyXG4gIC8qKlxyXG4gICAqIENsYXNzIGFwcGxpZWQgdG8gdGhlIGFjdGl2ZSBsb2NhdGlvbnMgbGluayBvbiB0aGUgbWFnZWxsYW4gY29udGFpbmVyLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnYWN0aXZlJ1xyXG4gICAqL1xyXG4gIGFjdGl2ZUNsYXNzOiAnYWN0aXZlJyxcclxuICAvKipcclxuICAgKiBBbGxvd3MgdGhlIHNjcmlwdCB0byBtYW5pcHVsYXRlIHRoZSB1cmwgb2YgdGhlIGN1cnJlbnQgcGFnZSwgYW5kIGlmIHN1cHBvcnRlZCwgYWx0ZXIgdGhlIGhpc3RvcnkuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIHRydWVcclxuICAgKi9cclxuICBkZWVwTGlua2luZzogZmFsc2UsXHJcbiAgLyoqXHJcbiAgICogTnVtYmVyIG9mIHBpeGVscyB0byBvZmZzZXQgdGhlIHNjcm9sbCBvZiB0aGUgcGFnZSBvbiBpdGVtIGNsaWNrIGlmIHVzaW5nIGEgc3RpY2t5IG5hdiBiYXIuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDI1XHJcbiAgICovXHJcbiAgYmFyT2Zmc2V0OiAwXHJcbn1cclxuXHJcbi8vIFdpbmRvdyBleHBvcnRzXHJcbkZvdW5kYXRpb24ucGx1Z2luKE1hZ2VsbGFuLCAnTWFnZWxsYW4nKTtcclxuXHJcbn0oalF1ZXJ5KTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuIWZ1bmN0aW9uKCQpIHtcclxuXHJcbi8qKlxyXG4gKiBPZmZDYW52YXMgbW9kdWxlLlxyXG4gKiBAbW9kdWxlIGZvdW5kYXRpb24ub2ZmY2FudmFzXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwubWVkaWFRdWVyeVxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLnRyaWdnZXJzXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwubW90aW9uXHJcbiAqL1xyXG5cclxuY2xhc3MgT2ZmQ2FudmFzIHtcclxuICAvKipcclxuICAgKiBDcmVhdGVzIGEgbmV3IGluc3RhbmNlIG9mIGFuIG9mZi1jYW52YXMgd3JhcHBlci5cclxuICAgKiBAY2xhc3NcclxuICAgKiBAZmlyZXMgT2ZmQ2FudmFzI2luaXRcclxuICAgKiBAcGFyYW0ge09iamVjdH0gZWxlbWVudCAtIGpRdWVyeSBvYmplY3QgdG8gaW5pdGlhbGl6ZS5cclxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyAtIE92ZXJyaWRlcyB0byB0aGUgZGVmYXVsdCBwbHVnaW4gc2V0dGluZ3MuXHJcbiAgICovXHJcbiAgY29uc3RydWN0b3IoZWxlbWVudCwgb3B0aW9ucykge1xyXG4gICAgdGhpcy4kZWxlbWVudCA9IGVsZW1lbnQ7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgT2ZmQ2FudmFzLmRlZmF1bHRzLCB0aGlzLiRlbGVtZW50LmRhdGEoKSwgb3B0aW9ucyk7XHJcbiAgICB0aGlzLiRsYXN0VHJpZ2dlciA9ICQoKTtcclxuICAgIHRoaXMuJHRyaWdnZXJzID0gJCgpO1xyXG5cclxuICAgIHRoaXMuX2luaXQoKTtcclxuICAgIHRoaXMuX2V2ZW50cygpO1xyXG5cclxuICAgIEZvdW5kYXRpb24ucmVnaXN0ZXJQbHVnaW4odGhpcywgJ09mZkNhbnZhcycpXHJcbiAgICBGb3VuZGF0aW9uLktleWJvYXJkLnJlZ2lzdGVyKCdPZmZDYW52YXMnLCB7XHJcbiAgICAgICdFU0NBUEUnOiAnY2xvc2UnXHJcbiAgICB9KTtcclxuXHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJbml0aWFsaXplcyB0aGUgb2ZmLWNhbnZhcyB3cmFwcGVyIGJ5IGFkZGluZyB0aGUgZXhpdCBvdmVybGF5IChpZiBuZWVkZWQpLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2luaXQoKSB7XHJcbiAgICB2YXIgaWQgPSB0aGlzLiRlbGVtZW50LmF0dHIoJ2lkJyk7XHJcblxyXG4gICAgdGhpcy4kZWxlbWVudC5hdHRyKCdhcmlhLWhpZGRlbicsICd0cnVlJyk7XHJcblxyXG4gICAgdGhpcy4kZWxlbWVudC5hZGRDbGFzcyhgaXMtdHJhbnNpdGlvbi0ke3RoaXMub3B0aW9ucy50cmFuc2l0aW9ufWApO1xyXG5cclxuICAgIC8vIEZpbmQgdHJpZ2dlcnMgdGhhdCBhZmZlY3QgdGhpcyBlbGVtZW50IGFuZCBhZGQgYXJpYS1leHBhbmRlZCB0byB0aGVtXHJcbiAgICB0aGlzLiR0cmlnZ2VycyA9ICQoZG9jdW1lbnQpXHJcbiAgICAgIC5maW5kKCdbZGF0YS1vcGVuPVwiJytpZCsnXCJdLCBbZGF0YS1jbG9zZT1cIicraWQrJ1wiXSwgW2RhdGEtdG9nZ2xlPVwiJytpZCsnXCJdJylcclxuICAgICAgLmF0dHIoJ2FyaWEtZXhwYW5kZWQnLCAnZmFsc2UnKVxyXG4gICAgICAuYXR0cignYXJpYS1jb250cm9scycsIGlkKTtcclxuXHJcbiAgICAvLyBBZGQgYW4gb3ZlcmxheSBvdmVyIHRoZSBjb250ZW50IGlmIG5lY2Vzc2FyeVxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5jb250ZW50T3ZlcmxheSA9PT0gdHJ1ZSkge1xyXG4gICAgICB2YXIgb3ZlcmxheSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgICB2YXIgb3ZlcmxheVBvc2l0aW9uID0gJCh0aGlzLiRlbGVtZW50KS5jc3MoXCJwb3NpdGlvblwiKSA9PT0gJ2ZpeGVkJyA/ICdpcy1vdmVybGF5LWZpeGVkJyA6ICdpcy1vdmVybGF5LWFic29sdXRlJztcclxuICAgICAgb3ZlcmxheS5zZXRBdHRyaWJ1dGUoJ2NsYXNzJywgJ2pzLW9mZi1jYW52YXMtb3ZlcmxheSAnICsgb3ZlcmxheVBvc2l0aW9uKTtcclxuICAgICAgdGhpcy4kb3ZlcmxheSA9ICQob3ZlcmxheSk7XHJcbiAgICAgIGlmKG92ZXJsYXlQb3NpdGlvbiA9PT0gJ2lzLW92ZXJsYXktZml4ZWQnKSB7XHJcbiAgICAgICAgJCgnYm9keScpLmFwcGVuZCh0aGlzLiRvdmVybGF5KTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzLiRlbGVtZW50LnNpYmxpbmdzKCdbZGF0YS1vZmYtY2FudmFzLWNvbnRlbnRdJykuYXBwZW5kKHRoaXMuJG92ZXJsYXkpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5vcHRpb25zLmlzUmV2ZWFsZWQgPSB0aGlzLm9wdGlvbnMuaXNSZXZlYWxlZCB8fCBuZXcgUmVnRXhwKHRoaXMub3B0aW9ucy5yZXZlYWxDbGFzcywgJ2cnKS50ZXN0KHRoaXMuJGVsZW1lbnRbMF0uY2xhc3NOYW1lKTtcclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmlzUmV2ZWFsZWQgPT09IHRydWUpIHtcclxuICAgICAgdGhpcy5vcHRpb25zLnJldmVhbE9uID0gdGhpcy5vcHRpb25zLnJldmVhbE9uIHx8IHRoaXMuJGVsZW1lbnRbMF0uY2xhc3NOYW1lLm1hdGNoKC8ocmV2ZWFsLWZvci1tZWRpdW18cmV2ZWFsLWZvci1sYXJnZSkvZylbMF0uc3BsaXQoJy0nKVsyXTtcclxuICAgICAgdGhpcy5fc2V0TVFDaGVja2VyKCk7XHJcbiAgICB9XHJcbiAgICBpZiAoIXRoaXMub3B0aW9ucy50cmFuc2l0aW9uVGltZSA9PT0gdHJ1ZSkge1xyXG4gICAgICB0aGlzLm9wdGlvbnMudHJhbnNpdGlvblRpbWUgPSBwYXJzZUZsb2F0KHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKCQoJ1tkYXRhLW9mZi1jYW52YXNdJylbMF0pLnRyYW5zaXRpb25EdXJhdGlvbikgKiAxMDAwO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBldmVudCBoYW5kbGVycyB0byB0aGUgb2ZmLWNhbnZhcyB3cmFwcGVyIGFuZCB0aGUgZXhpdCBvdmVybGF5LlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2V2ZW50cygpIHtcclxuICAgIHRoaXMuJGVsZW1lbnQub2ZmKCcuemYudHJpZ2dlciAuemYub2ZmY2FudmFzJykub24oe1xyXG4gICAgICAnb3Blbi56Zi50cmlnZ2VyJzogdGhpcy5vcGVuLmJpbmQodGhpcyksXHJcbiAgICAgICdjbG9zZS56Zi50cmlnZ2VyJzogdGhpcy5jbG9zZS5iaW5kKHRoaXMpLFxyXG4gICAgICAndG9nZ2xlLnpmLnRyaWdnZXInOiB0aGlzLnRvZ2dsZS5iaW5kKHRoaXMpLFxyXG4gICAgICAna2V5ZG93bi56Zi5vZmZjYW52YXMnOiB0aGlzLl9oYW5kbGVLZXlib2FyZC5iaW5kKHRoaXMpXHJcbiAgICB9KTtcclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmNsb3NlT25DbGljayA9PT0gdHJ1ZSkge1xyXG4gICAgICB2YXIgJHRhcmdldCA9IHRoaXMub3B0aW9ucy5jb250ZW50T3ZlcmxheSA/IHRoaXMuJG92ZXJsYXkgOiAkKCdbZGF0YS1vZmYtY2FudmFzLWNvbnRlbnRdJyk7XHJcbiAgICAgICR0YXJnZXQub24oeydjbGljay56Zi5vZmZjYW52YXMnOiB0aGlzLmNsb3NlLmJpbmQodGhpcyl9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFwcGxpZXMgZXZlbnQgbGlzdGVuZXIgZm9yIGVsZW1lbnRzIHRoYXQgd2lsbCByZXZlYWwgYXQgY2VydGFpbiBicmVha3BvaW50cy5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9zZXRNUUNoZWNrZXIoKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG5cclxuICAgICQod2luZG93KS5vbignY2hhbmdlZC56Zi5tZWRpYXF1ZXJ5JywgZnVuY3Rpb24oKSB7XHJcbiAgICAgIGlmIChGb3VuZGF0aW9uLk1lZGlhUXVlcnkuYXRMZWFzdChfdGhpcy5vcHRpb25zLnJldmVhbE9uKSkge1xyXG4gICAgICAgIF90aGlzLnJldmVhbCh0cnVlKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBfdGhpcy5yZXZlYWwoZmFsc2UpO1xyXG4gICAgICB9XHJcbiAgICB9KS5vbmUoJ2xvYWQuemYub2ZmY2FudmFzJywgZnVuY3Rpb24oKSB7XHJcbiAgICAgIGlmIChGb3VuZGF0aW9uLk1lZGlhUXVlcnkuYXRMZWFzdChfdGhpcy5vcHRpb25zLnJldmVhbE9uKSkge1xyXG4gICAgICAgIF90aGlzLnJldmVhbCh0cnVlKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGVzIHRoZSByZXZlYWxpbmcvaGlkaW5nIHRoZSBvZmYtY2FudmFzIGF0IGJyZWFrcG9pbnRzLCBub3QgdGhlIHNhbWUgYXMgb3Blbi5cclxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IGlzUmV2ZWFsZWQgLSB0cnVlIGlmIGVsZW1lbnQgc2hvdWxkIGJlIHJldmVhbGVkLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIHJldmVhbChpc1JldmVhbGVkKSB7XHJcbiAgICB2YXIgJGNsb3NlciA9IHRoaXMuJGVsZW1lbnQuZmluZCgnW2RhdGEtY2xvc2VdJyk7XHJcbiAgICBpZiAoaXNSZXZlYWxlZCkge1xyXG4gICAgICB0aGlzLmNsb3NlKCk7XHJcbiAgICAgIHRoaXMuaXNSZXZlYWxlZCA9IHRydWU7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQuYXR0cignYXJpYS1oaWRkZW4nLCAnZmFsc2UnKTtcclxuICAgICAgdGhpcy4kZWxlbWVudC5vZmYoJ29wZW4uemYudHJpZ2dlciB0b2dnbGUuemYudHJpZ2dlcicpO1xyXG4gICAgICBpZiAoJGNsb3Nlci5sZW5ndGgpIHsgJGNsb3Nlci5oaWRlKCk7IH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuaXNSZXZlYWxlZCA9IGZhbHNlO1xyXG4gICAgICB0aGlzLiRlbGVtZW50LmF0dHIoJ2FyaWEtaGlkZGVuJywgJ3RydWUnKTtcclxuICAgICAgdGhpcy4kZWxlbWVudC5vbih7XHJcbiAgICAgICAgJ29wZW4uemYudHJpZ2dlcic6IHRoaXMub3Blbi5iaW5kKHRoaXMpLFxyXG4gICAgICAgICd0b2dnbGUuemYudHJpZ2dlcic6IHRoaXMudG9nZ2xlLmJpbmQodGhpcylcclxuICAgICAgfSk7XHJcbiAgICAgIGlmICgkY2xvc2VyLmxlbmd0aCkge1xyXG4gICAgICAgICRjbG9zZXIuc2hvdygpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTdG9wcyBzY3JvbGxpbmcgb2YgdGhlIGJvZHkgd2hlbiBvZmZjYW52YXMgaXMgb3BlbiBvbiBtb2JpbGUgU2FmYXJpIGFuZCBvdGhlciB0cm91Ymxlc29tZSBicm93c2Vycy5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9zdG9wU2Nyb2xsaW5nKGV2ZW50KSB7XHJcbiAgXHRyZXR1cm4gZmFsc2U7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBPcGVucyB0aGUgb2ZmLWNhbnZhcyBtZW51LlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBldmVudCAtIEV2ZW50IG9iamVjdCBwYXNzZWQgZnJvbSBsaXN0ZW5lci5cclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gdHJpZ2dlciAtIGVsZW1lbnQgdGhhdCB0cmlnZ2VyZWQgdGhlIG9mZi1jYW52YXMgdG8gb3Blbi5cclxuICAgKiBAZmlyZXMgT2ZmQ2FudmFzI29wZW5lZFxyXG4gICAqL1xyXG4gIG9wZW4oZXZlbnQsIHRyaWdnZXIpIHtcclxuICAgIGlmICh0aGlzLiRlbGVtZW50Lmhhc0NsYXNzKCdpcy1vcGVuJykgfHwgdGhpcy5pc1JldmVhbGVkKSB7IHJldHVybjsgfVxyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuXHJcbiAgICBpZiAodHJpZ2dlcikge1xyXG4gICAgICB0aGlzLiRsYXN0VHJpZ2dlciA9IHRyaWdnZXI7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5mb3JjZVRvID09PSAndG9wJykge1xyXG4gICAgICB3aW5kb3cuc2Nyb2xsVG8oMCwgMCk7XHJcbiAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9ucy5mb3JjZVRvID09PSAnYm90dG9tJykge1xyXG4gICAgICB3aW5kb3cuc2Nyb2xsVG8oMCxkb2N1bWVudC5ib2R5LnNjcm9sbEhlaWdodCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGaXJlcyB3aGVuIHRoZSBvZmYtY2FudmFzIG1lbnUgb3BlbnMuXHJcbiAgICAgKiBAZXZlbnQgT2ZmQ2FudmFzI29wZW5lZFxyXG4gICAgICovXHJcbiAgICBfdGhpcy4kZWxlbWVudC5hZGRDbGFzcygnaXMtb3BlbicpXHJcblxyXG4gICAgdGhpcy4kdHJpZ2dlcnMuYXR0cignYXJpYS1leHBhbmRlZCcsICd0cnVlJyk7XHJcbiAgICB0aGlzLiRlbGVtZW50LmF0dHIoJ2FyaWEtaGlkZGVuJywgJ2ZhbHNlJylcclxuICAgICAgICAudHJpZ2dlcignb3BlbmVkLnpmLm9mZmNhbnZhcycpO1xyXG5cclxuICAgIC8vIElmIGBjb250ZW50U2Nyb2xsYCBpcyBzZXQgdG8gZmFsc2UsIGFkZCBjbGFzcyBhbmQgZGlzYWJsZSBzY3JvbGxpbmcgb24gdG91Y2ggZGV2aWNlcy5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMuY29udGVudFNjcm9sbCA9PT0gZmFsc2UpIHtcclxuICAgICAgJCgnYm9keScpLmFkZENsYXNzKCdpcy1vZmYtY2FudmFzLW9wZW4nKS5vbigndG91Y2htb3ZlJywgdGhpcy5fc3RvcFNjcm9sbGluZyk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5jb250ZW50T3ZlcmxheSA9PT0gdHJ1ZSkge1xyXG4gICAgICB0aGlzLiRvdmVybGF5LmFkZENsYXNzKCdpcy12aXNpYmxlJyk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5jbG9zZU9uQ2xpY2sgPT09IHRydWUgJiYgdGhpcy5vcHRpb25zLmNvbnRlbnRPdmVybGF5ID09PSB0cnVlKSB7XHJcbiAgICAgIHRoaXMuJG92ZXJsYXkuYWRkQ2xhc3MoJ2lzLWNsb3NhYmxlJyk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5hdXRvRm9jdXMgPT09IHRydWUpIHtcclxuICAgICAgdGhpcy4kZWxlbWVudC5vbmUoRm91bmRhdGlvbi50cmFuc2l0aW9uZW5kKHRoaXMuJGVsZW1lbnQpLCBmdW5jdGlvbigpIHtcclxuICAgICAgICBfdGhpcy4kZWxlbWVudC5maW5kKCdhLCBidXR0b24nKS5lcSgwKS5mb2N1cygpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLnRyYXBGb2N1cyA9PT0gdHJ1ZSkge1xyXG4gICAgICB0aGlzLiRlbGVtZW50LnNpYmxpbmdzKCdbZGF0YS1vZmYtY2FudmFzLWNvbnRlbnRdJykuYXR0cigndGFiaW5kZXgnLCAnLTEnKTtcclxuICAgICAgRm91bmRhdGlvbi5LZXlib2FyZC50cmFwRm9jdXModGhpcy4kZWxlbWVudCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDbG9zZXMgdGhlIG9mZi1jYW52YXMgbWVudS5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYiAtIG9wdGlvbmFsIGNiIHRvIGZpcmUgYWZ0ZXIgY2xvc3VyZS5cclxuICAgKiBAZmlyZXMgT2ZmQ2FudmFzI2Nsb3NlZFxyXG4gICAqL1xyXG4gIGNsb3NlKGNiKSB7XHJcbiAgICBpZiAoIXRoaXMuJGVsZW1lbnQuaGFzQ2xhc3MoJ2lzLW9wZW4nKSB8fCB0aGlzLmlzUmV2ZWFsZWQpIHsgcmV0dXJuOyB9XHJcblxyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuXHJcbiAgICBfdGhpcy4kZWxlbWVudC5yZW1vdmVDbGFzcygnaXMtb3BlbicpO1xyXG5cclxuICAgIHRoaXMuJGVsZW1lbnQuYXR0cignYXJpYS1oaWRkZW4nLCAndHJ1ZScpXHJcbiAgICAgIC8qKlxyXG4gICAgICAgKiBGaXJlcyB3aGVuIHRoZSBvZmYtY2FudmFzIG1lbnUgb3BlbnMuXHJcbiAgICAgICAqIEBldmVudCBPZmZDYW52YXMjY2xvc2VkXHJcbiAgICAgICAqL1xyXG4gICAgICAgIC50cmlnZ2VyKCdjbG9zZWQuemYub2ZmY2FudmFzJyk7XHJcblxyXG4gICAgLy8gSWYgYGNvbnRlbnRTY3JvbGxgIGlzIHNldCB0byBmYWxzZSwgcmVtb3ZlIGNsYXNzIGFuZCByZS1lbmFibGUgc2Nyb2xsaW5nIG9uIHRvdWNoIGRldmljZXMuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmNvbnRlbnRTY3JvbGwgPT09IGZhbHNlKSB7XHJcbiAgICAgICQoJ2JvZHknKS5yZW1vdmVDbGFzcygnaXMtb2ZmLWNhbnZhcy1vcGVuJykub2ZmKCd0b3VjaG1vdmUnLCB0aGlzLl9zdG9wU2Nyb2xsaW5nKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmNvbnRlbnRPdmVybGF5ID09PSB0cnVlKSB7XHJcbiAgICAgIHRoaXMuJG92ZXJsYXkucmVtb3ZlQ2xhc3MoJ2lzLXZpc2libGUnKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmNsb3NlT25DbGljayA9PT0gdHJ1ZSAmJiB0aGlzLm9wdGlvbnMuY29udGVudE92ZXJsYXkgPT09IHRydWUpIHtcclxuICAgICAgdGhpcy4kb3ZlcmxheS5yZW1vdmVDbGFzcygnaXMtY2xvc2FibGUnKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLiR0cmlnZ2Vycy5hdHRyKCdhcmlhLWV4cGFuZGVkJywgJ2ZhbHNlJyk7XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy50cmFwRm9jdXMgPT09IHRydWUpIHtcclxuICAgICAgdGhpcy4kZWxlbWVudC5zaWJsaW5ncygnW2RhdGEtb2ZmLWNhbnZhcy1jb250ZW50XScpLnJlbW92ZUF0dHIoJ3RhYmluZGV4Jyk7XHJcbiAgICAgIEZvdW5kYXRpb24uS2V5Ym9hcmQucmVsZWFzZUZvY3VzKHRoaXMuJGVsZW1lbnQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVG9nZ2xlcyB0aGUgb2ZmLWNhbnZhcyBtZW51IG9wZW4gb3IgY2xvc2VkLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBldmVudCAtIEV2ZW50IG9iamVjdCBwYXNzZWQgZnJvbSBsaXN0ZW5lci5cclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gdHJpZ2dlciAtIGVsZW1lbnQgdGhhdCB0cmlnZ2VyZWQgdGhlIG9mZi1jYW52YXMgdG8gb3Blbi5cclxuICAgKi9cclxuICB0b2dnbGUoZXZlbnQsIHRyaWdnZXIpIHtcclxuICAgIGlmICh0aGlzLiRlbGVtZW50Lmhhc0NsYXNzKCdpcy1vcGVuJykpIHtcclxuICAgICAgdGhpcy5jbG9zZShldmVudCwgdHJpZ2dlcik7XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgdGhpcy5vcGVuKGV2ZW50LCB0cmlnZ2VyKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZXMga2V5Ym9hcmQgaW5wdXQgd2hlbiBkZXRlY3RlZC4gV2hlbiB0aGUgZXNjYXBlIGtleSBpcyBwcmVzc2VkLCB0aGUgb2ZmLWNhbnZhcyBtZW51IGNsb3NlcywgYW5kIGZvY3VzIGlzIHJlc3RvcmVkIHRvIHRoZSBlbGVtZW50IHRoYXQgb3BlbmVkIHRoZSBtZW51LlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2hhbmRsZUtleWJvYXJkKGUpIHtcclxuICAgIEZvdW5kYXRpb24uS2V5Ym9hcmQuaGFuZGxlS2V5KGUsICdPZmZDYW52YXMnLCB7XHJcbiAgICAgIGNsb3NlOiAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xyXG4gICAgICAgIHRoaXMuJGxhc3RUcmlnZ2VyLmZvY3VzKCk7XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgIH0sXHJcbiAgICAgIGhhbmRsZWQ6ICgpID0+IHtcclxuICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZXN0cm95cyB0aGUgb2ZmY2FudmFzIHBsdWdpbi5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICBkZXN0cm95KCkge1xyXG4gICAgdGhpcy5jbG9zZSgpO1xyXG4gICAgdGhpcy4kZWxlbWVudC5vZmYoJy56Zi50cmlnZ2VyIC56Zi5vZmZjYW52YXMnKTtcclxuICAgIHRoaXMuJG92ZXJsYXkub2ZmKCcuemYub2ZmY2FudmFzJyk7XHJcblxyXG4gICAgRm91bmRhdGlvbi51bnJlZ2lzdGVyUGx1Z2luKHRoaXMpO1xyXG4gIH1cclxufVxyXG5cclxuT2ZmQ2FudmFzLmRlZmF1bHRzID0ge1xyXG4gIC8qKlxyXG4gICAqIEFsbG93IHRoZSB1c2VyIHRvIGNsaWNrIG91dHNpZGUgb2YgdGhlIG1lbnUgdG8gY2xvc2UgaXQuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIHRydWVcclxuICAgKi9cclxuICBjbG9zZU9uQ2xpY2s6IHRydWUsXHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMgYW4gb3ZlcmxheSBvbiB0b3Agb2YgYFtkYXRhLW9mZi1jYW52YXMtY29udGVudF1gLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSB0cnVlXHJcbiAgICovXHJcbiAgY29udGVudE92ZXJsYXk6IHRydWUsXHJcblxyXG4gIC8qKlxyXG4gICAqIEVuYWJsZS9kaXNhYmxlIHNjcm9sbGluZyBvZiB0aGUgbWFpbiBjb250ZW50IHdoZW4gYW4gb2ZmIGNhbnZhcyBwYW5lbCBpcyBvcGVuLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSB0cnVlXHJcbiAgICovXHJcbiAgY29udGVudFNjcm9sbDogdHJ1ZSxcclxuXHJcbiAgLyoqXHJcbiAgICogQW1vdW50IG9mIHRpbWUgaW4gbXMgdGhlIG9wZW4gYW5kIGNsb3NlIHRyYW5zaXRpb24gcmVxdWlyZXMuIElmIG5vbmUgc2VsZWN0ZWQsIHB1bGxzIGZyb20gYm9keSBzdHlsZS5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgNTAwXHJcbiAgICovXHJcbiAgdHJhbnNpdGlvblRpbWU6IDAsXHJcblxyXG4gIC8qKlxyXG4gICAqIFR5cGUgb2YgdHJhbnNpdGlvbiBmb3IgdGhlIG9mZmNhbnZhcyBtZW51LiBPcHRpb25zIGFyZSAncHVzaCcsICdkZXRhY2hlZCcgb3IgJ3NsaWRlJy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgcHVzaFxyXG4gICAqL1xyXG4gIHRyYW5zaXRpb246ICdwdXNoJyxcclxuXHJcbiAgLyoqXHJcbiAgICogRm9yY2UgdGhlIHBhZ2UgdG8gc2Nyb2xsIHRvIHRvcCBvciBib3R0b20gb24gb3Blbi5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgdG9wXHJcbiAgICovXHJcbiAgZm9yY2VUbzogbnVsbCxcclxuXHJcbiAgLyoqXHJcbiAgICogQWxsb3cgdGhlIG9mZmNhbnZhcyB0byByZW1haW4gb3BlbiBmb3IgY2VydGFpbiBicmVha3BvaW50cy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBpc1JldmVhbGVkOiBmYWxzZSxcclxuXHJcbiAgLyoqXHJcbiAgICogQnJlYWtwb2ludCBhdCB3aGljaCB0byByZXZlYWwuIEpTIHdpbGwgdXNlIGEgUmVnRXhwIHRvIHRhcmdldCBzdGFuZGFyZCBjbGFzc2VzLCBpZiBjaGFuZ2luZyBjbGFzc25hbWVzLCBwYXNzIHlvdXIgY2xhc3Mgd2l0aCB0aGUgYHJldmVhbENsYXNzYCBvcHRpb24uXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIHJldmVhbC1mb3ItbGFyZ2VcclxuICAgKi9cclxuICByZXZlYWxPbjogbnVsbCxcclxuXHJcbiAgLyoqXHJcbiAgICogRm9yY2UgZm9jdXMgdG8gdGhlIG9mZmNhbnZhcyBvbiBvcGVuLiBJZiB0cnVlLCB3aWxsIGZvY3VzIHRoZSBvcGVuaW5nIHRyaWdnZXIgb24gY2xvc2UuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIHRydWVcclxuICAgKi9cclxuICBhdXRvRm9jdXM6IHRydWUsXHJcblxyXG4gIC8qKlxyXG4gICAqIENsYXNzIHVzZWQgdG8gZm9yY2UgYW4gb2ZmY2FudmFzIHRvIHJlbWFpbiBvcGVuLiBGb3VuZGF0aW9uIGRlZmF1bHRzIGZvciB0aGlzIGFyZSBgcmV2ZWFsLWZvci1sYXJnZWAgJiBgcmV2ZWFsLWZvci1tZWRpdW1gLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBUT0RPIGltcHJvdmUgdGhlIHJlZ2V4IHRlc3RpbmcgZm9yIHRoaXMuXHJcbiAgICogQGV4YW1wbGUgcmV2ZWFsLWZvci1sYXJnZVxyXG4gICAqL1xyXG4gIHJldmVhbENsYXNzOiAncmV2ZWFsLWZvci0nLFxyXG5cclxuICAvKipcclxuICAgKiBUcmlnZ2VycyBvcHRpb25hbCBmb2N1cyB0cmFwcGluZyB3aGVuIG9wZW5pbmcgYW4gb2ZmY2FudmFzLiBTZXRzIHRhYmluZGV4IG9mIFtkYXRhLW9mZi1jYW52YXMtY29udGVudF0gdG8gLTEgZm9yIGFjY2Vzc2liaWxpdHkgcHVycG9zZXMuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIHRydWVcclxuICAgKi9cclxuICB0cmFwRm9jdXM6IGZhbHNlXHJcbn1cclxuXHJcbi8vIFdpbmRvdyBleHBvcnRzXHJcbkZvdW5kYXRpb24ucGx1Z2luKE9mZkNhbnZhcywgJ09mZkNhbnZhcycpO1xyXG5cclxufShqUXVlcnkpO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG4hZnVuY3Rpb24oJCkge1xyXG5cclxuLyoqXHJcbiAqIE9yYml0IG1vZHVsZS5cclxuICogQG1vZHVsZSBmb3VuZGF0aW9uLm9yYml0XHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwua2V5Ym9hcmRcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5tb3Rpb25cclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC50aW1lckFuZEltYWdlTG9hZGVyXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwudG91Y2hcclxuICovXHJcblxyXG5jbGFzcyBPcmJpdCB7XHJcbiAgLyoqXHJcbiAgKiBDcmVhdGVzIGEgbmV3IGluc3RhbmNlIG9mIGFuIG9yYml0IGNhcm91c2VsLlxyXG4gICogQGNsYXNzXHJcbiAgKiBAcGFyYW0ge2pRdWVyeX0gZWxlbWVudCAtIGpRdWVyeSBvYmplY3QgdG8gbWFrZSBpbnRvIGFuIE9yYml0IENhcm91c2VsLlxyXG4gICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgLSBPdmVycmlkZXMgdG8gdGhlIGRlZmF1bHQgcGx1Z2luIHNldHRpbmdzLlxyXG4gICovXHJcbiAgY29uc3RydWN0b3IoZWxlbWVudCwgb3B0aW9ucyl7XHJcbiAgICB0aGlzLiRlbGVtZW50ID0gZWxlbWVudDtcclxuICAgIHRoaXMub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBPcmJpdC5kZWZhdWx0cywgdGhpcy4kZWxlbWVudC5kYXRhKCksIG9wdGlvbnMpO1xyXG5cclxuICAgIHRoaXMuX2luaXQoKTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLnJlZ2lzdGVyUGx1Z2luKHRoaXMsICdPcmJpdCcpO1xyXG4gICAgRm91bmRhdGlvbi5LZXlib2FyZC5yZWdpc3RlcignT3JiaXQnLCB7XHJcbiAgICAgICdsdHInOiB7XHJcbiAgICAgICAgJ0FSUk9XX1JJR0hUJzogJ25leHQnLFxyXG4gICAgICAgICdBUlJPV19MRUZUJzogJ3ByZXZpb3VzJ1xyXG4gICAgICB9LFxyXG4gICAgICAncnRsJzoge1xyXG4gICAgICAgICdBUlJPV19MRUZUJzogJ25leHQnLFxyXG4gICAgICAgICdBUlJPV19SSUdIVCc6ICdwcmV2aW91cydcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAqIEluaXRpYWxpemVzIHRoZSBwbHVnaW4gYnkgY3JlYXRpbmcgalF1ZXJ5IGNvbGxlY3Rpb25zLCBzZXR0aW5nIGF0dHJpYnV0ZXMsIGFuZCBzdGFydGluZyB0aGUgYW5pbWF0aW9uLlxyXG4gICogQGZ1bmN0aW9uXHJcbiAgKiBAcHJpdmF0ZVxyXG4gICovXHJcbiAgX2luaXQoKSB7XHJcbiAgICAvLyBAVE9ETzogY29uc2lkZXIgZGlzY3Vzc2lvbiBvbiBQUiAjOTI3OCBhYm91dCBET00gcG9sbHV0aW9uIGJ5IGNoYW5nZVNsaWRlXHJcbiAgICB0aGlzLl9yZXNldCgpO1xyXG5cclxuICAgIHRoaXMuJHdyYXBwZXIgPSB0aGlzLiRlbGVtZW50LmZpbmQoYC4ke3RoaXMub3B0aW9ucy5jb250YWluZXJDbGFzc31gKTtcclxuICAgIHRoaXMuJHNsaWRlcyA9IHRoaXMuJGVsZW1lbnQuZmluZChgLiR7dGhpcy5vcHRpb25zLnNsaWRlQ2xhc3N9YCk7XHJcblxyXG4gICAgdmFyICRpbWFnZXMgPSB0aGlzLiRlbGVtZW50LmZpbmQoJ2ltZycpLFxyXG4gICAgICAgIGluaXRBY3RpdmUgPSB0aGlzLiRzbGlkZXMuZmlsdGVyKCcuaXMtYWN0aXZlJyksXHJcbiAgICAgICAgaWQgPSB0aGlzLiRlbGVtZW50WzBdLmlkIHx8IEZvdW5kYXRpb24uR2V0WW9EaWdpdHMoNiwgJ29yYml0Jyk7XHJcblxyXG4gICAgdGhpcy4kZWxlbWVudC5hdHRyKHtcclxuICAgICAgJ2RhdGEtcmVzaXplJzogaWQsXHJcbiAgICAgICdpZCc6IGlkXHJcbiAgICB9KTtcclxuXHJcbiAgICBpZiAoIWluaXRBY3RpdmUubGVuZ3RoKSB7XHJcbiAgICAgIHRoaXMuJHNsaWRlcy5lcSgwKS5hZGRDbGFzcygnaXMtYWN0aXZlJyk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCF0aGlzLm9wdGlvbnMudXNlTVVJKSB7XHJcbiAgICAgIHRoaXMuJHNsaWRlcy5hZGRDbGFzcygnbm8tbW90aW9udWknKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoJGltYWdlcy5sZW5ndGgpIHtcclxuICAgICAgRm91bmRhdGlvbi5vbkltYWdlc0xvYWRlZCgkaW1hZ2VzLCB0aGlzLl9wcmVwYXJlRm9yT3JiaXQuYmluZCh0aGlzKSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLl9wcmVwYXJlRm9yT3JiaXQoKTsvL2hlaGVcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmJ1bGxldHMpIHtcclxuICAgICAgdGhpcy5fbG9hZEJ1bGxldHMoKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLl9ldmVudHMoKTtcclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmF1dG9QbGF5ICYmIHRoaXMuJHNsaWRlcy5sZW5ndGggPiAxKSB7XHJcbiAgICAgIHRoaXMuZ2VvU3luYygpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMuYWNjZXNzaWJsZSkgeyAvLyBhbGxvdyB3cmFwcGVyIHRvIGJlIGZvY3VzYWJsZSB0byBlbmFibGUgYXJyb3cgbmF2aWdhdGlvblxyXG4gICAgICB0aGlzLiR3cmFwcGVyLmF0dHIoJ3RhYmluZGV4JywgMCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAqIENyZWF0ZXMgYSBqUXVlcnkgY29sbGVjdGlvbiBvZiBidWxsZXRzLCBpZiB0aGV5IGFyZSBiZWluZyB1c2VkLlxyXG4gICogQGZ1bmN0aW9uXHJcbiAgKiBAcHJpdmF0ZVxyXG4gICovXHJcbiAgX2xvYWRCdWxsZXRzKCkge1xyXG4gICAgdGhpcy4kYnVsbGV0cyA9IHRoaXMuJGVsZW1lbnQuZmluZChgLiR7dGhpcy5vcHRpb25zLmJveE9mQnVsbGV0c31gKS5maW5kKCdidXR0b24nKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICogU2V0cyBhIGB0aW1lcmAgb2JqZWN0IG9uIHRoZSBvcmJpdCwgYW5kIHN0YXJ0cyB0aGUgY291bnRlciBmb3IgdGhlIG5leHQgc2xpZGUuXHJcbiAgKiBAZnVuY3Rpb25cclxuICAqL1xyXG4gIGdlb1N5bmMoKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgdGhpcy50aW1lciA9IG5ldyBGb3VuZGF0aW9uLlRpbWVyKFxyXG4gICAgICB0aGlzLiRlbGVtZW50LFxyXG4gICAgICB7XHJcbiAgICAgICAgZHVyYXRpb246IHRoaXMub3B0aW9ucy50aW1lckRlbGF5LFxyXG4gICAgICAgIGluZmluaXRlOiBmYWxzZVxyXG4gICAgICB9LFxyXG4gICAgICBmdW5jdGlvbigpIHtcclxuICAgICAgICBfdGhpcy5jaGFuZ2VTbGlkZSh0cnVlKTtcclxuICAgICAgfSk7XHJcbiAgICB0aGlzLnRpbWVyLnN0YXJ0KCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAqIFNldHMgd3JhcHBlciBhbmQgc2xpZGUgaGVpZ2h0cyBmb3IgdGhlIG9yYml0LlxyXG4gICogQGZ1bmN0aW9uXHJcbiAgKiBAcHJpdmF0ZVxyXG4gICovXHJcbiAgX3ByZXBhcmVGb3JPcmJpdCgpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICB0aGlzLl9zZXRXcmFwcGVySGVpZ2h0KCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAqIENhbHVsYXRlcyB0aGUgaGVpZ2h0IG9mIGVhY2ggc2xpZGUgaW4gdGhlIGNvbGxlY3Rpb24sIGFuZCB1c2VzIHRoZSB0YWxsZXN0IG9uZSBmb3IgdGhlIHdyYXBwZXIgaGVpZ2h0LlxyXG4gICogQGZ1bmN0aW9uXHJcbiAgKiBAcHJpdmF0ZVxyXG4gICogQHBhcmFtIHtGdW5jdGlvbn0gY2IgLSBhIGNhbGxiYWNrIGZ1bmN0aW9uIHRvIGZpcmUgd2hlbiBjb21wbGV0ZS5cclxuICAqL1xyXG4gIF9zZXRXcmFwcGVySGVpZ2h0KGNiKSB7Ly9yZXdyaXRlIHRoaXMgdG8gYGZvcmAgbG9vcFxyXG4gICAgdmFyIG1heCA9IDAsIHRlbXAsIGNvdW50ZXIgPSAwLCBfdGhpcyA9IHRoaXM7XHJcblxyXG4gICAgdGhpcy4kc2xpZGVzLmVhY2goZnVuY3Rpb24oKSB7XHJcbiAgICAgIHRlbXAgPSB0aGlzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLmhlaWdodDtcclxuICAgICAgJCh0aGlzKS5hdHRyKCdkYXRhLXNsaWRlJywgY291bnRlcik7XHJcblxyXG4gICAgICBpZiAoX3RoaXMuJHNsaWRlcy5maWx0ZXIoJy5pcy1hY3RpdmUnKVswXSAhPT0gX3RoaXMuJHNsaWRlcy5lcShjb3VudGVyKVswXSkgey8vaWYgbm90IHRoZSBhY3RpdmUgc2xpZGUsIHNldCBjc3MgcG9zaXRpb24gYW5kIGRpc3BsYXkgcHJvcGVydHlcclxuICAgICAgICAkKHRoaXMpLmNzcyh7J3Bvc2l0aW9uJzogJ3JlbGF0aXZlJywgJ2Rpc3BsYXknOiAnbm9uZSd9KTtcclxuICAgICAgfVxyXG4gICAgICBtYXggPSB0ZW1wID4gbWF4ID8gdGVtcCA6IG1heDtcclxuICAgICAgY291bnRlcisrO1xyXG4gICAgfSk7XHJcblxyXG4gICAgaWYgKGNvdW50ZXIgPT09IHRoaXMuJHNsaWRlcy5sZW5ndGgpIHtcclxuICAgICAgdGhpcy4kd3JhcHBlci5jc3MoeydoZWlnaHQnOiBtYXh9KTsgLy9vbmx5IGNoYW5nZSB0aGUgd3JhcHBlciBoZWlnaHQgcHJvcGVydHkgb25jZS5cclxuICAgICAgaWYoY2IpIHtjYihtYXgpO30gLy9maXJlIGNhbGxiYWNrIHdpdGggbWF4IGhlaWdodCBkaW1lbnNpb24uXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAqIFNldHMgdGhlIG1heC1oZWlnaHQgb2YgZWFjaCBzbGlkZS5cclxuICAqIEBmdW5jdGlvblxyXG4gICogQHByaXZhdGVcclxuICAqL1xyXG4gIF9zZXRTbGlkZUhlaWdodChoZWlnaHQpIHtcclxuICAgIHRoaXMuJHNsaWRlcy5lYWNoKGZ1bmN0aW9uKCkge1xyXG4gICAgICAkKHRoaXMpLmNzcygnbWF4LWhlaWdodCcsIGhlaWdodCk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICogQWRkcyBldmVudCBsaXN0ZW5lcnMgdG8gYmFzaWNhbGx5IGV2ZXJ5dGhpbmcgd2l0aGluIHRoZSBlbGVtZW50LlxyXG4gICogQGZ1bmN0aW9uXHJcbiAgKiBAcHJpdmF0ZVxyXG4gICovXHJcbiAgX2V2ZW50cygpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcblxyXG4gICAgLy8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuICAgIC8vKipOb3cgdXNpbmcgY3VzdG9tIGV2ZW50IC0gdGhhbmtzIHRvOioqXHJcbiAgICAvLyoqICAgICAgWW9oYWkgQXJhcmF0IG9mIFRvcm9udG8gICAgICAqKlxyXG4gICAgLy8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuICAgIC8vXHJcbiAgICB0aGlzLiRlbGVtZW50Lm9mZignLnJlc2l6ZW1lLnpmLnRyaWdnZXInKS5vbih7XHJcbiAgICAgICdyZXNpemVtZS56Zi50cmlnZ2VyJzogdGhpcy5fcHJlcGFyZUZvck9yYml0LmJpbmQodGhpcylcclxuICAgIH0pXHJcbiAgICBpZiAodGhpcy4kc2xpZGVzLmxlbmd0aCA+IDEpIHtcclxuXHJcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuc3dpcGUpIHtcclxuICAgICAgICB0aGlzLiRzbGlkZXMub2ZmKCdzd2lwZWxlZnQuemYub3JiaXQgc3dpcGVyaWdodC56Zi5vcmJpdCcpXHJcbiAgICAgICAgLm9uKCdzd2lwZWxlZnQuemYub3JiaXQnLCBmdW5jdGlvbihlKXtcclxuICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgIF90aGlzLmNoYW5nZVNsaWRlKHRydWUpO1xyXG4gICAgICAgIH0pLm9uKCdzd2lwZXJpZ2h0LnpmLm9yYml0JywgZnVuY3Rpb24oZSl7XHJcbiAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICBfdGhpcy5jaGFuZ2VTbGlkZShmYWxzZSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgICAgLy8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuXHJcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuYXV0b1BsYXkpIHtcclxuICAgICAgICB0aGlzLiRzbGlkZXMub24oJ2NsaWNrLnpmLm9yYml0JywgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICBfdGhpcy4kZWxlbWVudC5kYXRhKCdjbGlja2VkT24nLCBfdGhpcy4kZWxlbWVudC5kYXRhKCdjbGlja2VkT24nKSA/IGZhbHNlIDogdHJ1ZSk7XHJcbiAgICAgICAgICBfdGhpcy50aW1lcltfdGhpcy4kZWxlbWVudC5kYXRhKCdjbGlja2VkT24nKSA/ICdwYXVzZScgOiAnc3RhcnQnXSgpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnBhdXNlT25Ib3Zlcikge1xyXG4gICAgICAgICAgdGhpcy4kZWxlbWVudC5vbignbW91c2VlbnRlci56Zi5vcmJpdCcsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICBfdGhpcy50aW1lci5wYXVzZSgpO1xyXG4gICAgICAgICAgfSkub24oJ21vdXNlbGVhdmUuemYub3JiaXQnLCBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgaWYgKCFfdGhpcy4kZWxlbWVudC5kYXRhKCdjbGlja2VkT24nKSkge1xyXG4gICAgICAgICAgICAgIF90aGlzLnRpbWVyLnN0YXJ0KCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5uYXZCdXR0b25zKSB7XHJcbiAgICAgICAgdmFyICRjb250cm9scyA9IHRoaXMuJGVsZW1lbnQuZmluZChgLiR7dGhpcy5vcHRpb25zLm5leHRDbGFzc30sIC4ke3RoaXMub3B0aW9ucy5wcmV2Q2xhc3N9YCk7XHJcbiAgICAgICAgJGNvbnRyb2xzLmF0dHIoJ3RhYmluZGV4JywgMClcclxuICAgICAgICAvL2Fsc28gbmVlZCB0byBoYW5kbGUgZW50ZXIvcmV0dXJuIGFuZCBzcGFjZWJhciBrZXkgcHJlc3Nlc1xyXG4gICAgICAgIC5vbignY2xpY2suemYub3JiaXQgdG91Y2hlbmQuemYub3JiaXQnLCBmdW5jdGlvbihlKXtcclxuXHQgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgIF90aGlzLmNoYW5nZVNsaWRlKCQodGhpcykuaGFzQ2xhc3MoX3RoaXMub3B0aW9ucy5uZXh0Q2xhc3MpKTtcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5idWxsZXRzKSB7XHJcbiAgICAgICAgdGhpcy4kYnVsbGV0cy5vbignY2xpY2suemYub3JiaXQgdG91Y2hlbmQuemYub3JiaXQnLCBmdW5jdGlvbigpIHtcclxuICAgICAgICAgIGlmICgvaXMtYWN0aXZlL2cudGVzdCh0aGlzLmNsYXNzTmFtZSkpIHsgcmV0dXJuIGZhbHNlOyB9Ly9pZiB0aGlzIGlzIGFjdGl2ZSwga2ljayBvdXQgb2YgZnVuY3Rpb24uXHJcbiAgICAgICAgICB2YXIgaWR4ID0gJCh0aGlzKS5kYXRhKCdzbGlkZScpLFxyXG4gICAgICAgICAgbHRyID0gaWR4ID4gX3RoaXMuJHNsaWRlcy5maWx0ZXIoJy5pcy1hY3RpdmUnKS5kYXRhKCdzbGlkZScpLFxyXG4gICAgICAgICAgJHNsaWRlID0gX3RoaXMuJHNsaWRlcy5lcShpZHgpO1xyXG5cclxuICAgICAgICAgIF90aGlzLmNoYW5nZVNsaWRlKGx0ciwgJHNsaWRlLCBpZHgpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAodGhpcy5vcHRpb25zLmFjY2Vzc2libGUpIHtcclxuICAgICAgICB0aGlzLiR3cmFwcGVyLmFkZCh0aGlzLiRidWxsZXRzKS5vbigna2V5ZG93bi56Zi5vcmJpdCcsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAgIC8vIGhhbmRsZSBrZXlib2FyZCBldmVudCB3aXRoIGtleWJvYXJkIHV0aWxcclxuICAgICAgICAgIEZvdW5kYXRpb24uS2V5Ym9hcmQuaGFuZGxlS2V5KGUsICdPcmJpdCcsIHtcclxuICAgICAgICAgICAgbmV4dDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgX3RoaXMuY2hhbmdlU2xpZGUodHJ1ZSk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHByZXZpb3VzOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICBfdGhpcy5jaGFuZ2VTbGlkZShmYWxzZSk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGhhbmRsZWQ6IGZ1bmN0aW9uKCkgeyAvLyBpZiBidWxsZXQgaXMgZm9jdXNlZCwgbWFrZSBzdXJlIGZvY3VzIG1vdmVzXHJcbiAgICAgICAgICAgICAgaWYgKCQoZS50YXJnZXQpLmlzKF90aGlzLiRidWxsZXRzKSkge1xyXG4gICAgICAgICAgICAgICAgX3RoaXMuJGJ1bGxldHMuZmlsdGVyKCcuaXMtYWN0aXZlJykuZm9jdXMoKTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZXNldHMgT3JiaXQgc28gaXQgY2FuIGJlIHJlaW5pdGlhbGl6ZWRcclxuICAgKi9cclxuICBfcmVzZXQoKSB7XHJcbiAgICAvLyBEb24ndCBkbyBhbnl0aGluZyBpZiB0aGVyZSBhcmUgbm8gc2xpZGVzIChmaXJzdCBydW4pXHJcbiAgICBpZiAodHlwZW9mIHRoaXMuJHNsaWRlcyA9PSAndW5kZWZpbmVkJykge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMuJHNsaWRlcy5sZW5ndGggPiAxKSB7XHJcbiAgICAgIC8vIFJlbW92ZSBvbGQgZXZlbnRzXHJcbiAgICAgIHRoaXMuJGVsZW1lbnQub2ZmKCcuemYub3JiaXQnKS5maW5kKCcqJykub2ZmKCcuemYub3JiaXQnKVxyXG5cclxuICAgICAgLy8gUmVzdGFydCB0aW1lciBpZiBhdXRvUGxheSBpcyBlbmFibGVkXHJcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuYXV0b1BsYXkpIHtcclxuICAgICAgICB0aGlzLnRpbWVyLnJlc3RhcnQoKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gUmVzZXQgYWxsIHNsaWRkZXNcclxuICAgICAgdGhpcy4kc2xpZGVzLmVhY2goZnVuY3Rpb24oZWwpIHtcclxuICAgICAgICAkKGVsKS5yZW1vdmVDbGFzcygnaXMtYWN0aXZlIGlzLWFjdGl2ZSBpcy1pbicpXHJcbiAgICAgICAgICAucmVtb3ZlQXR0cignYXJpYS1saXZlJylcclxuICAgICAgICAgIC5oaWRlKCk7XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgLy8gU2hvdyB0aGUgZmlyc3Qgc2xpZGVcclxuICAgICAgdGhpcy4kc2xpZGVzLmZpcnN0KCkuYWRkQ2xhc3MoJ2lzLWFjdGl2ZScpLnNob3coKTtcclxuXHJcbiAgICAgIC8vIFRyaWdnZXJzIHdoZW4gdGhlIHNsaWRlIGhhcyBmaW5pc2hlZCBhbmltYXRpbmdcclxuICAgICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdzbGlkZWNoYW5nZS56Zi5vcmJpdCcsIFt0aGlzLiRzbGlkZXMuZmlyc3QoKV0pO1xyXG5cclxuICAgICAgLy8gU2VsZWN0IGZpcnN0IGJ1bGxldCBpZiBidWxsZXRzIGFyZSBwcmVzZW50XHJcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuYnVsbGV0cykge1xyXG4gICAgICAgIHRoaXMuX3VwZGF0ZUJ1bGxldHMoMCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICogQ2hhbmdlcyB0aGUgY3VycmVudCBzbGlkZSB0byBhIG5ldyBvbmUuXHJcbiAgKiBAZnVuY3Rpb25cclxuICAqIEBwYXJhbSB7Qm9vbGVhbn0gaXNMVFIgLSBmbGFnIGlmIHRoZSBzbGlkZSBzaG91bGQgbW92ZSBsZWZ0IHRvIHJpZ2h0LlxyXG4gICogQHBhcmFtIHtqUXVlcnl9IGNob3NlblNsaWRlIC0gdGhlIGpRdWVyeSBlbGVtZW50IG9mIHRoZSBzbGlkZSB0byBzaG93IG5leHQsIGlmIG9uZSBpcyBzZWxlY3RlZC5cclxuICAqIEBwYXJhbSB7TnVtYmVyfSBpZHggLSB0aGUgaW5kZXggb2YgdGhlIG5ldyBzbGlkZSBpbiBpdHMgY29sbGVjdGlvbiwgaWYgb25lIGNob3Nlbi5cclxuICAqIEBmaXJlcyBPcmJpdCNzbGlkZWNoYW5nZVxyXG4gICovXHJcbiAgY2hhbmdlU2xpZGUoaXNMVFIsIGNob3NlblNsaWRlLCBpZHgpIHtcclxuICAgIGlmICghdGhpcy4kc2xpZGVzKSB7cmV0dXJuOyB9IC8vIERvbid0IGZyZWFrIG91dCBpZiB3ZSdyZSBpbiB0aGUgbWlkZGxlIG9mIGNsZWFudXBcclxuICAgIHZhciAkY3VyU2xpZGUgPSB0aGlzLiRzbGlkZXMuZmlsdGVyKCcuaXMtYWN0aXZlJykuZXEoMCk7XHJcblxyXG4gICAgaWYgKC9tdWkvZy50ZXN0KCRjdXJTbGlkZVswXS5jbGFzc05hbWUpKSB7IHJldHVybiBmYWxzZTsgfSAvL2lmIHRoZSBzbGlkZSBpcyBjdXJyZW50bHkgYW5pbWF0aW5nLCBraWNrIG91dCBvZiB0aGUgZnVuY3Rpb25cclxuXHJcbiAgICB2YXIgJGZpcnN0U2xpZGUgPSB0aGlzLiRzbGlkZXMuZmlyc3QoKSxcclxuICAgICRsYXN0U2xpZGUgPSB0aGlzLiRzbGlkZXMubGFzdCgpLFxyXG4gICAgZGlySW4gPSBpc0xUUiA/ICdSaWdodCcgOiAnTGVmdCcsXHJcbiAgICBkaXJPdXQgPSBpc0xUUiA/ICdMZWZ0JyA6ICdSaWdodCcsXHJcbiAgICBfdGhpcyA9IHRoaXMsXHJcbiAgICAkbmV3U2xpZGU7XHJcblxyXG4gICAgaWYgKCFjaG9zZW5TbGlkZSkgeyAvL21vc3Qgb2YgdGhlIHRpbWUsIHRoaXMgd2lsbCBiZSBhdXRvIHBsYXllZCBvciBjbGlja2VkIGZyb20gdGhlIG5hdkJ1dHRvbnMuXHJcbiAgICAgICRuZXdTbGlkZSA9IGlzTFRSID8gLy9pZiB3cmFwcGluZyBlbmFibGVkLCBjaGVjayB0byBzZWUgaWYgdGhlcmUgaXMgYSBgbmV4dGAgb3IgYHByZXZgIHNpYmxpbmcsIGlmIG5vdCwgc2VsZWN0IHRoZSBmaXJzdCBvciBsYXN0IHNsaWRlIHRvIGZpbGwgaW4uIGlmIHdyYXBwaW5nIG5vdCBlbmFibGVkLCBhdHRlbXB0IHRvIHNlbGVjdCBgbmV4dGAgb3IgYHByZXZgLCBpZiB0aGVyZSdzIG5vdGhpbmcgdGhlcmUsIHRoZSBmdW5jdGlvbiB3aWxsIGtpY2sgb3V0IG9uIG5leHQgc3RlcC4gQ1JBWlkgTkVTVEVEIFRFUk5BUklFUyEhISEhXHJcbiAgICAgICh0aGlzLm9wdGlvbnMuaW5maW5pdGVXcmFwID8gJGN1clNsaWRlLm5leHQoYC4ke3RoaXMub3B0aW9ucy5zbGlkZUNsYXNzfWApLmxlbmd0aCA/ICRjdXJTbGlkZS5uZXh0KGAuJHt0aGlzLm9wdGlvbnMuc2xpZGVDbGFzc31gKSA6ICRmaXJzdFNsaWRlIDogJGN1clNsaWRlLm5leHQoYC4ke3RoaXMub3B0aW9ucy5zbGlkZUNsYXNzfWApKS8vcGljayBuZXh0IHNsaWRlIGlmIG1vdmluZyBsZWZ0IHRvIHJpZ2h0XHJcbiAgICAgIDpcclxuICAgICAgKHRoaXMub3B0aW9ucy5pbmZpbml0ZVdyYXAgPyAkY3VyU2xpZGUucHJldihgLiR7dGhpcy5vcHRpb25zLnNsaWRlQ2xhc3N9YCkubGVuZ3RoID8gJGN1clNsaWRlLnByZXYoYC4ke3RoaXMub3B0aW9ucy5zbGlkZUNsYXNzfWApIDogJGxhc3RTbGlkZSA6ICRjdXJTbGlkZS5wcmV2KGAuJHt0aGlzLm9wdGlvbnMuc2xpZGVDbGFzc31gKSk7Ly9waWNrIHByZXYgc2xpZGUgaWYgbW92aW5nIHJpZ2h0IHRvIGxlZnRcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICRuZXdTbGlkZSA9IGNob3NlblNsaWRlO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICgkbmV3U2xpZGUubGVuZ3RoKSB7XHJcbiAgICAgIC8qKlxyXG4gICAgICAqIFRyaWdnZXJzIGJlZm9yZSB0aGUgbmV4dCBzbGlkZSBzdGFydHMgYW5pbWF0aW5nIGluIGFuZCBvbmx5IGlmIGEgbmV4dCBzbGlkZSBoYXMgYmVlbiBmb3VuZC5cclxuICAgICAgKiBAZXZlbnQgT3JiaXQjYmVmb3Jlc2xpZGVjaGFuZ2VcclxuICAgICAgKi9cclxuICAgICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdiZWZvcmVzbGlkZWNoYW5nZS56Zi5vcmJpdCcsIFskY3VyU2xpZGUsICRuZXdTbGlkZV0pO1xyXG5cclxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5idWxsZXRzKSB7XHJcbiAgICAgICAgaWR4ID0gaWR4IHx8IHRoaXMuJHNsaWRlcy5pbmRleCgkbmV3U2xpZGUpOyAvL2dyYWIgaW5kZXggdG8gdXBkYXRlIGJ1bGxldHNcclxuICAgICAgICB0aGlzLl91cGRhdGVCdWxsZXRzKGlkeCk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMudXNlTVVJICYmICF0aGlzLiRlbGVtZW50LmlzKCc6aGlkZGVuJykpIHtcclxuICAgICAgICBGb3VuZGF0aW9uLk1vdGlvbi5hbmltYXRlSW4oXHJcbiAgICAgICAgICAkbmV3U2xpZGUuYWRkQ2xhc3MoJ2lzLWFjdGl2ZScpLmNzcyh7J3Bvc2l0aW9uJzogJ2Fic29sdXRlJywgJ3RvcCc6IDB9KSxcclxuICAgICAgICAgIHRoaXMub3B0aW9uc1tgYW5pbUluRnJvbSR7ZGlySW59YF0sXHJcbiAgICAgICAgICBmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICAkbmV3U2xpZGUuY3NzKHsncG9zaXRpb24nOiAncmVsYXRpdmUnLCAnZGlzcGxheSc6ICdibG9jayd9KVxyXG4gICAgICAgICAgICAuYXR0cignYXJpYS1saXZlJywgJ3BvbGl0ZScpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBGb3VuZGF0aW9uLk1vdGlvbi5hbmltYXRlT3V0KFxyXG4gICAgICAgICAgJGN1clNsaWRlLnJlbW92ZUNsYXNzKCdpcy1hY3RpdmUnKSxcclxuICAgICAgICAgIHRoaXMub3B0aW9uc1tgYW5pbU91dFRvJHtkaXJPdXR9YF0sXHJcbiAgICAgICAgICBmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICAkY3VyU2xpZGUucmVtb3ZlQXR0cignYXJpYS1saXZlJyk7XHJcbiAgICAgICAgICAgIGlmKF90aGlzLm9wdGlvbnMuYXV0b1BsYXkgJiYgIV90aGlzLnRpbWVyLmlzUGF1c2VkKXtcclxuICAgICAgICAgICAgICBfdGhpcy50aW1lci5yZXN0YXJ0KCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgLy9kbyBzdHVmZj9cclxuICAgICAgICAgIH0pO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgICRjdXJTbGlkZS5yZW1vdmVDbGFzcygnaXMtYWN0aXZlIGlzLWluJykucmVtb3ZlQXR0cignYXJpYS1saXZlJykuaGlkZSgpO1xyXG4gICAgICAgICRuZXdTbGlkZS5hZGRDbGFzcygnaXMtYWN0aXZlIGlzLWluJykuYXR0cignYXJpYS1saXZlJywgJ3BvbGl0ZScpLnNob3coKTtcclxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmF1dG9QbGF5ICYmICF0aGlzLnRpbWVyLmlzUGF1c2VkKSB7XHJcbiAgICAgICAgICB0aGlzLnRpbWVyLnJlc3RhcnQoKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIC8qKlxyXG4gICAgKiBUcmlnZ2VycyB3aGVuIHRoZSBzbGlkZSBoYXMgZmluaXNoZWQgYW5pbWF0aW5nIGluLlxyXG4gICAgKiBAZXZlbnQgT3JiaXQjc2xpZGVjaGFuZ2VcclxuICAgICovXHJcbiAgICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcignc2xpZGVjaGFuZ2UuemYub3JiaXQnLCBbJG5ld1NsaWRlXSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAqIFVwZGF0ZXMgdGhlIGFjdGl2ZSBzdGF0ZSBvZiB0aGUgYnVsbGV0cywgaWYgZGlzcGxheWVkLlxyXG4gICogQGZ1bmN0aW9uXHJcbiAgKiBAcHJpdmF0ZVxyXG4gICogQHBhcmFtIHtOdW1iZXJ9IGlkeCAtIHRoZSBpbmRleCBvZiB0aGUgY3VycmVudCBzbGlkZS5cclxuICAqL1xyXG4gIF91cGRhdGVCdWxsZXRzKGlkeCkge1xyXG4gICAgdmFyICRvbGRCdWxsZXQgPSB0aGlzLiRlbGVtZW50LmZpbmQoYC4ke3RoaXMub3B0aW9ucy5ib3hPZkJ1bGxldHN9YClcclxuICAgIC5maW5kKCcuaXMtYWN0aXZlJykucmVtb3ZlQ2xhc3MoJ2lzLWFjdGl2ZScpLmJsdXIoKSxcclxuICAgIHNwYW4gPSAkb2xkQnVsbGV0LmZpbmQoJ3NwYW46bGFzdCcpLmRldGFjaCgpLFxyXG4gICAgJG5ld0J1bGxldCA9IHRoaXMuJGJ1bGxldHMuZXEoaWR4KS5hZGRDbGFzcygnaXMtYWN0aXZlJykuYXBwZW5kKHNwYW4pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgKiBEZXN0cm95cyB0aGUgY2Fyb3VzZWwgYW5kIGhpZGVzIHRoZSBlbGVtZW50LlxyXG4gICogQGZ1bmN0aW9uXHJcbiAgKi9cclxuICBkZXN0cm95KCkge1xyXG4gICAgdGhpcy4kZWxlbWVudC5vZmYoJy56Zi5vcmJpdCcpLmZpbmQoJyonKS5vZmYoJy56Zi5vcmJpdCcpLmVuZCgpLmhpZGUoKTtcclxuICAgIEZvdW5kYXRpb24udW5yZWdpc3RlclBsdWdpbih0aGlzKTtcclxuICB9XHJcbn1cclxuXHJcbk9yYml0LmRlZmF1bHRzID0ge1xyXG4gIC8qKlxyXG4gICogVGVsbHMgdGhlIEpTIHRvIGxvb2sgZm9yIGFuZCBsb2FkQnVsbGV0cy5cclxuICAqIEBvcHRpb25cclxuICAqIEBleGFtcGxlIHRydWVcclxuICAqL1xyXG4gIGJ1bGxldHM6IHRydWUsXHJcbiAgLyoqXHJcbiAgKiBUZWxscyB0aGUgSlMgdG8gYXBwbHkgZXZlbnQgbGlzdGVuZXJzIHRvIG5hdiBidXR0b25zXHJcbiAgKiBAb3B0aW9uXHJcbiAgKiBAZXhhbXBsZSB0cnVlXHJcbiAgKi9cclxuICBuYXZCdXR0b25zOiB0cnVlLFxyXG4gIC8qKlxyXG4gICogbW90aW9uLXVpIGFuaW1hdGlvbiBjbGFzcyB0byBhcHBseVxyXG4gICogQG9wdGlvblxyXG4gICogQGV4YW1wbGUgJ3NsaWRlLWluLXJpZ2h0J1xyXG4gICovXHJcbiAgYW5pbUluRnJvbVJpZ2h0OiAnc2xpZGUtaW4tcmlnaHQnLFxyXG4gIC8qKlxyXG4gICogbW90aW9uLXVpIGFuaW1hdGlvbiBjbGFzcyB0byBhcHBseVxyXG4gICogQG9wdGlvblxyXG4gICogQGV4YW1wbGUgJ3NsaWRlLW91dC1yaWdodCdcclxuICAqL1xyXG4gIGFuaW1PdXRUb1JpZ2h0OiAnc2xpZGUtb3V0LXJpZ2h0JyxcclxuICAvKipcclxuICAqIG1vdGlvbi11aSBhbmltYXRpb24gY2xhc3MgdG8gYXBwbHlcclxuICAqIEBvcHRpb25cclxuICAqIEBleGFtcGxlICdzbGlkZS1pbi1sZWZ0J1xyXG4gICpcclxuICAqL1xyXG4gIGFuaW1JbkZyb21MZWZ0OiAnc2xpZGUtaW4tbGVmdCcsXHJcbiAgLyoqXHJcbiAgKiBtb3Rpb24tdWkgYW5pbWF0aW9uIGNsYXNzIHRvIGFwcGx5XHJcbiAgKiBAb3B0aW9uXHJcbiAgKiBAZXhhbXBsZSAnc2xpZGUtb3V0LWxlZnQnXHJcbiAgKi9cclxuICBhbmltT3V0VG9MZWZ0OiAnc2xpZGUtb3V0LWxlZnQnLFxyXG4gIC8qKlxyXG4gICogQWxsb3dzIE9yYml0IHRvIGF1dG9tYXRpY2FsbHkgYW5pbWF0ZSBvbiBwYWdlIGxvYWQuXHJcbiAgKiBAb3B0aW9uXHJcbiAgKiBAZXhhbXBsZSB0cnVlXHJcbiAgKi9cclxuICBhdXRvUGxheTogdHJ1ZSxcclxuICAvKipcclxuICAqIEFtb3VudCBvZiB0aW1lLCBpbiBtcywgYmV0d2VlbiBzbGlkZSB0cmFuc2l0aW9uc1xyXG4gICogQG9wdGlvblxyXG4gICogQGV4YW1wbGUgNTAwMFxyXG4gICovXHJcbiAgdGltZXJEZWxheTogNTAwMCxcclxuICAvKipcclxuICAqIEFsbG93cyBPcmJpdCB0byBpbmZpbml0ZWx5IGxvb3AgdGhyb3VnaCB0aGUgc2xpZGVzXHJcbiAgKiBAb3B0aW9uXHJcbiAgKiBAZXhhbXBsZSB0cnVlXHJcbiAgKi9cclxuICBpbmZpbml0ZVdyYXA6IHRydWUsXHJcbiAgLyoqXHJcbiAgKiBBbGxvd3MgdGhlIE9yYml0IHNsaWRlcyB0byBiaW5kIHRvIHN3aXBlIGV2ZW50cyBmb3IgbW9iaWxlLCByZXF1aXJlcyBhbiBhZGRpdGlvbmFsIHV0aWwgbGlicmFyeVxyXG4gICogQG9wdGlvblxyXG4gICogQGV4YW1wbGUgdHJ1ZVxyXG4gICovXHJcbiAgc3dpcGU6IHRydWUsXHJcbiAgLyoqXHJcbiAgKiBBbGxvd3MgdGhlIHRpbWluZyBmdW5jdGlvbiB0byBwYXVzZSBhbmltYXRpb24gb24gaG92ZXIuXHJcbiAgKiBAb3B0aW9uXHJcbiAgKiBAZXhhbXBsZSB0cnVlXHJcbiAgKi9cclxuICBwYXVzZU9uSG92ZXI6IHRydWUsXHJcbiAgLyoqXHJcbiAgKiBBbGxvd3MgT3JiaXQgdG8gYmluZCBrZXlib2FyZCBldmVudHMgdG8gdGhlIHNsaWRlciwgdG8gYW5pbWF0ZSBmcmFtZXMgd2l0aCBhcnJvdyBrZXlzXHJcbiAgKiBAb3B0aW9uXHJcbiAgKiBAZXhhbXBsZSB0cnVlXHJcbiAgKi9cclxuICBhY2Nlc3NpYmxlOiB0cnVlLFxyXG4gIC8qKlxyXG4gICogQ2xhc3MgYXBwbGllZCB0byB0aGUgY29udGFpbmVyIG9mIE9yYml0XHJcbiAgKiBAb3B0aW9uXHJcbiAgKiBAZXhhbXBsZSAnb3JiaXQtY29udGFpbmVyJ1xyXG4gICovXHJcbiAgY29udGFpbmVyQ2xhc3M6ICdvcmJpdC1jb250YWluZXInLFxyXG4gIC8qKlxyXG4gICogQ2xhc3MgYXBwbGllZCB0byBpbmRpdmlkdWFsIHNsaWRlcy5cclxuICAqIEBvcHRpb25cclxuICAqIEBleGFtcGxlICdvcmJpdC1zbGlkZSdcclxuICAqL1xyXG4gIHNsaWRlQ2xhc3M6ICdvcmJpdC1zbGlkZScsXHJcbiAgLyoqXHJcbiAgKiBDbGFzcyBhcHBsaWVkIHRvIHRoZSBidWxsZXQgY29udGFpbmVyLiBZb3UncmUgd2VsY29tZS5cclxuICAqIEBvcHRpb25cclxuICAqIEBleGFtcGxlICdvcmJpdC1idWxsZXRzJ1xyXG4gICovXHJcbiAgYm94T2ZCdWxsZXRzOiAnb3JiaXQtYnVsbGV0cycsXHJcbiAgLyoqXHJcbiAgKiBDbGFzcyBhcHBsaWVkIHRvIHRoZSBgbmV4dGAgbmF2aWdhdGlvbiBidXR0b24uXHJcbiAgKiBAb3B0aW9uXHJcbiAgKiBAZXhhbXBsZSAnb3JiaXQtbmV4dCdcclxuICAqL1xyXG4gIG5leHRDbGFzczogJ29yYml0LW5leHQnLFxyXG4gIC8qKlxyXG4gICogQ2xhc3MgYXBwbGllZCB0byB0aGUgYHByZXZpb3VzYCBuYXZpZ2F0aW9uIGJ1dHRvbi5cclxuICAqIEBvcHRpb25cclxuICAqIEBleGFtcGxlICdvcmJpdC1wcmV2aW91cydcclxuICAqL1xyXG4gIHByZXZDbGFzczogJ29yYml0LXByZXZpb3VzJyxcclxuICAvKipcclxuICAqIEJvb2xlYW4gdG8gZmxhZyB0aGUganMgdG8gdXNlIG1vdGlvbiB1aSBjbGFzc2VzIG9yIG5vdC4gRGVmYXVsdCB0byB0cnVlIGZvciBiYWNrd2FyZHMgY29tcGF0YWJpbGl0eS5cclxuICAqIEBvcHRpb25cclxuICAqIEBleGFtcGxlIHRydWVcclxuICAqL1xyXG4gIHVzZU1VSTogdHJ1ZVxyXG59O1xyXG5cclxuLy8gV2luZG93IGV4cG9ydHNcclxuRm91bmRhdGlvbi5wbHVnaW4oT3JiaXQsICdPcmJpdCcpO1xyXG5cclxufShqUXVlcnkpO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG4hZnVuY3Rpb24oJCkge1xyXG5cclxuLyoqXHJcbiAqIFJlc3BvbnNpdmVNZW51IG1vZHVsZS5cclxuICogQG1vZHVsZSBmb3VuZGF0aW9uLnJlc3BvbnNpdmVNZW51XHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwudHJpZ2dlcnNcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5tZWRpYVF1ZXJ5XHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwuYWNjb3JkaW9uTWVudVxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLmRyaWxsZG93blxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLmRyb3Bkb3duLW1lbnVcclxuICovXHJcblxyXG5jbGFzcyBSZXNwb25zaXZlTWVudSB7XHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlcyBhIG5ldyBpbnN0YW5jZSBvZiBhIHJlc3BvbnNpdmUgbWVudS5cclxuICAgKiBAY2xhc3NcclxuICAgKiBAZmlyZXMgUmVzcG9uc2l2ZU1lbnUjaW5pdFxyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSBlbGVtZW50IC0galF1ZXJ5IG9iamVjdCB0byBtYWtlIGludG8gYSBkcm9wZG93biBtZW51LlxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIC0gT3ZlcnJpZGVzIHRvIHRoZSBkZWZhdWx0IHBsdWdpbiBzZXR0aW5ncy5cclxuICAgKi9cclxuICBjb25zdHJ1Y3RvcihlbGVtZW50LCBvcHRpb25zKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50ID0gJChlbGVtZW50KTtcclxuICAgIHRoaXMucnVsZXMgPSB0aGlzLiRlbGVtZW50LmRhdGEoJ3Jlc3BvbnNpdmUtbWVudScpO1xyXG4gICAgdGhpcy5jdXJyZW50TXEgPSBudWxsO1xyXG4gICAgdGhpcy5jdXJyZW50UGx1Z2luID0gbnVsbDtcclxuXHJcbiAgICB0aGlzLl9pbml0KCk7XHJcbiAgICB0aGlzLl9ldmVudHMoKTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLnJlZ2lzdGVyUGx1Z2luKHRoaXMsICdSZXNwb25zaXZlTWVudScpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbGl6ZXMgdGhlIE1lbnUgYnkgcGFyc2luZyB0aGUgY2xhc3NlcyBmcm9tIHRoZSAnZGF0YS1SZXNwb25zaXZlTWVudScgYXR0cmlidXRlIG9uIHRoZSBlbGVtZW50LlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2luaXQoKSB7XHJcbiAgICAvLyBUaGUgZmlyc3QgdGltZSBhbiBJbnRlcmNoYW5nZSBwbHVnaW4gaXMgaW5pdGlhbGl6ZWQsIHRoaXMucnVsZXMgaXMgY29udmVydGVkIGZyb20gYSBzdHJpbmcgb2YgXCJjbGFzc2VzXCIgdG8gYW4gb2JqZWN0IG9mIHJ1bGVzXHJcbiAgICBpZiAodHlwZW9mIHRoaXMucnVsZXMgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgIGxldCBydWxlc1RyZWUgPSB7fTtcclxuXHJcbiAgICAgIC8vIFBhcnNlIHJ1bGVzIGZyb20gXCJjbGFzc2VzXCIgcHVsbGVkIGZyb20gZGF0YSBhdHRyaWJ1dGVcclxuICAgICAgbGV0IHJ1bGVzID0gdGhpcy5ydWxlcy5zcGxpdCgnICcpO1xyXG5cclxuICAgICAgLy8gSXRlcmF0ZSB0aHJvdWdoIGV2ZXJ5IHJ1bGUgZm91bmRcclxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBydWxlcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIGxldCBydWxlID0gcnVsZXNbaV0uc3BsaXQoJy0nKTtcclxuICAgICAgICBsZXQgcnVsZVNpemUgPSBydWxlLmxlbmd0aCA+IDEgPyBydWxlWzBdIDogJ3NtYWxsJztcclxuICAgICAgICBsZXQgcnVsZVBsdWdpbiA9IHJ1bGUubGVuZ3RoID4gMSA/IHJ1bGVbMV0gOiBydWxlWzBdO1xyXG5cclxuICAgICAgICBpZiAoTWVudVBsdWdpbnNbcnVsZVBsdWdpbl0gIT09IG51bGwpIHtcclxuICAgICAgICAgIHJ1bGVzVHJlZVtydWxlU2l6ZV0gPSBNZW51UGx1Z2luc1tydWxlUGx1Z2luXTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHRoaXMucnVsZXMgPSBydWxlc1RyZWU7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCEkLmlzRW1wdHlPYmplY3QodGhpcy5ydWxlcykpIHtcclxuICAgICAgdGhpcy5fY2hlY2tNZWRpYVF1ZXJpZXMoKTtcclxuICAgIH1cclxuICAgIC8vIEFkZCBkYXRhLW11dGF0ZSBzaW5jZSBjaGlsZHJlbiBtYXkgbmVlZCBpdC5cclxuICAgIHRoaXMuJGVsZW1lbnQuYXR0cignZGF0YS1tdXRhdGUnLCAodGhpcy4kZWxlbWVudC5hdHRyKCdkYXRhLW11dGF0ZScpIHx8IEZvdW5kYXRpb24uR2V0WW9EaWdpdHMoNiwgJ3Jlc3BvbnNpdmUtbWVudScpKSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJbml0aWFsaXplcyBldmVudHMgZm9yIHRoZSBNZW51LlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2V2ZW50cygpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcblxyXG4gICAgJCh3aW5kb3cpLm9uKCdjaGFuZ2VkLnpmLm1lZGlhcXVlcnknLCBmdW5jdGlvbigpIHtcclxuICAgICAgX3RoaXMuX2NoZWNrTWVkaWFRdWVyaWVzKCk7XHJcbiAgICB9KTtcclxuICAgIC8vICQod2luZG93KS5vbigncmVzaXplLnpmLlJlc3BvbnNpdmVNZW51JywgZnVuY3Rpb24oKSB7XHJcbiAgICAvLyAgIF90aGlzLl9jaGVja01lZGlhUXVlcmllcygpO1xyXG4gICAgLy8gfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVja3MgdGhlIGN1cnJlbnQgc2NyZWVuIHdpZHRoIGFnYWluc3QgYXZhaWxhYmxlIG1lZGlhIHF1ZXJpZXMuIElmIHRoZSBtZWRpYSBxdWVyeSBoYXMgY2hhbmdlZCwgYW5kIHRoZSBwbHVnaW4gbmVlZGVkIGhhcyBjaGFuZ2VkLCB0aGUgcGx1Z2lucyB3aWxsIHN3YXAgb3V0LlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2NoZWNrTWVkaWFRdWVyaWVzKCkge1xyXG4gICAgdmFyIG1hdGNoZWRNcSwgX3RoaXMgPSB0aGlzO1xyXG4gICAgLy8gSXRlcmF0ZSB0aHJvdWdoIGVhY2ggcnVsZSBhbmQgZmluZCB0aGUgbGFzdCBtYXRjaGluZyBydWxlXHJcbiAgICAkLmVhY2godGhpcy5ydWxlcywgZnVuY3Rpb24oa2V5KSB7XHJcbiAgICAgIGlmIChGb3VuZGF0aW9uLk1lZGlhUXVlcnkuYXRMZWFzdChrZXkpKSB7XHJcbiAgICAgICAgbWF0Y2hlZE1xID0ga2V5O1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBObyBtYXRjaD8gTm8gZGljZVxyXG4gICAgaWYgKCFtYXRjaGVkTXEpIHJldHVybjtcclxuXHJcbiAgICAvLyBQbHVnaW4gYWxyZWFkeSBpbml0aWFsaXplZD8gV2UgZ29vZFxyXG4gICAgaWYgKHRoaXMuY3VycmVudFBsdWdpbiBpbnN0YW5jZW9mIHRoaXMucnVsZXNbbWF0Y2hlZE1xXS5wbHVnaW4pIHJldHVybjtcclxuXHJcbiAgICAvLyBSZW1vdmUgZXhpc3RpbmcgcGx1Z2luLXNwZWNpZmljIENTUyBjbGFzc2VzXHJcbiAgICAkLmVhY2goTWVudVBsdWdpbnMsIGZ1bmN0aW9uKGtleSwgdmFsdWUpIHtcclxuICAgICAgX3RoaXMuJGVsZW1lbnQucmVtb3ZlQ2xhc3ModmFsdWUuY3NzQ2xhc3MpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQWRkIHRoZSBDU1MgY2xhc3MgZm9yIHRoZSBuZXcgcGx1Z2luXHJcbiAgICB0aGlzLiRlbGVtZW50LmFkZENsYXNzKHRoaXMucnVsZXNbbWF0Y2hlZE1xXS5jc3NDbGFzcyk7XHJcblxyXG4gICAgLy8gQ3JlYXRlIGFuIGluc3RhbmNlIG9mIHRoZSBuZXcgcGx1Z2luXHJcbiAgICBpZiAodGhpcy5jdXJyZW50UGx1Z2luKSB0aGlzLmN1cnJlbnRQbHVnaW4uZGVzdHJveSgpO1xyXG4gICAgdGhpcy5jdXJyZW50UGx1Z2luID0gbmV3IHRoaXMucnVsZXNbbWF0Y2hlZE1xXS5wbHVnaW4odGhpcy4kZWxlbWVudCwge30pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVzdHJveXMgdGhlIGluc3RhbmNlIG9mIHRoZSBjdXJyZW50IHBsdWdpbiBvbiB0aGlzIGVsZW1lbnQsIGFzIHdlbGwgYXMgdGhlIHdpbmRvdyByZXNpemUgaGFuZGxlciB0aGF0IHN3aXRjaGVzIHRoZSBwbHVnaW5zIG91dC5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICBkZXN0cm95KCkge1xyXG4gICAgdGhpcy5jdXJyZW50UGx1Z2luLmRlc3Ryb3koKTtcclxuICAgICQod2luZG93KS5vZmYoJy56Zi5SZXNwb25zaXZlTWVudScpO1xyXG4gICAgRm91bmRhdGlvbi51bnJlZ2lzdGVyUGx1Z2luKHRoaXMpO1xyXG4gIH1cclxufVxyXG5cclxuUmVzcG9uc2l2ZU1lbnUuZGVmYXVsdHMgPSB7fTtcclxuXHJcbi8vIFRoZSBwbHVnaW4gbWF0Y2hlcyB0aGUgcGx1Z2luIGNsYXNzZXMgd2l0aCB0aGVzZSBwbHVnaW4gaW5zdGFuY2VzLlxyXG52YXIgTWVudVBsdWdpbnMgPSB7XHJcbiAgZHJvcGRvd246IHtcclxuICAgIGNzc0NsYXNzOiAnZHJvcGRvd24nLFxyXG4gICAgcGx1Z2luOiBGb3VuZGF0aW9uLl9wbHVnaW5zWydkcm9wZG93bi1tZW51J10gfHwgbnVsbFxyXG4gIH0sXHJcbiBkcmlsbGRvd246IHtcclxuICAgIGNzc0NsYXNzOiAnZHJpbGxkb3duJyxcclxuICAgIHBsdWdpbjogRm91bmRhdGlvbi5fcGx1Z2luc1snZHJpbGxkb3duJ10gfHwgbnVsbFxyXG4gIH0sXHJcbiAgYWNjb3JkaW9uOiB7XHJcbiAgICBjc3NDbGFzczogJ2FjY29yZGlvbi1tZW51JyxcclxuICAgIHBsdWdpbjogRm91bmRhdGlvbi5fcGx1Z2luc1snYWNjb3JkaW9uLW1lbnUnXSB8fCBudWxsXHJcbiAgfVxyXG59O1xyXG5cclxuLy8gV2luZG93IGV4cG9ydHNcclxuRm91bmRhdGlvbi5wbHVnaW4oUmVzcG9uc2l2ZU1lbnUsICdSZXNwb25zaXZlTWVudScpO1xyXG5cclxufShqUXVlcnkpO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG4hZnVuY3Rpb24oJCkge1xyXG5cclxuLyoqXHJcbiAqIFJlc3BvbnNpdmVUb2dnbGUgbW9kdWxlLlxyXG4gKiBAbW9kdWxlIGZvdW5kYXRpb24ucmVzcG9uc2l2ZVRvZ2dsZVxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLm1lZGlhUXVlcnlcclxuICovXHJcblxyXG5jbGFzcyBSZXNwb25zaXZlVG9nZ2xlIHtcclxuICAvKipcclxuICAgKiBDcmVhdGVzIGEgbmV3IGluc3RhbmNlIG9mIFRhYiBCYXIuXHJcbiAgICogQGNsYXNzXHJcbiAgICogQGZpcmVzIFJlc3BvbnNpdmVUb2dnbGUjaW5pdFxyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSBlbGVtZW50IC0galF1ZXJ5IG9iamVjdCB0byBhdHRhY2ggdGFiIGJhciBmdW5jdGlvbmFsaXR5IHRvLlxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIC0gT3ZlcnJpZGVzIHRvIHRoZSBkZWZhdWx0IHBsdWdpbiBzZXR0aW5ncy5cclxuICAgKi9cclxuICBjb25zdHJ1Y3RvcihlbGVtZW50LCBvcHRpb25zKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50ID0gJChlbGVtZW50KTtcclxuICAgIHRoaXMub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBSZXNwb25zaXZlVG9nZ2xlLmRlZmF1bHRzLCB0aGlzLiRlbGVtZW50LmRhdGEoKSwgb3B0aW9ucyk7XHJcblxyXG4gICAgdGhpcy5faW5pdCgpO1xyXG4gICAgdGhpcy5fZXZlbnRzKCk7XHJcblxyXG4gICAgRm91bmRhdGlvbi5yZWdpc3RlclBsdWdpbih0aGlzLCAnUmVzcG9uc2l2ZVRvZ2dsZScpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbGl6ZXMgdGhlIHRhYiBiYXIgYnkgZmluZGluZyB0aGUgdGFyZ2V0IGVsZW1lbnQsIHRvZ2dsaW5nIGVsZW1lbnQsIGFuZCBydW5uaW5nIHVwZGF0ZSgpLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2luaXQoKSB7XHJcbiAgICB2YXIgdGFyZ2V0SUQgPSB0aGlzLiRlbGVtZW50LmRhdGEoJ3Jlc3BvbnNpdmUtdG9nZ2xlJyk7XHJcbiAgICBpZiAoIXRhcmdldElEKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1lvdXIgdGFiIGJhciBuZWVkcyBhbiBJRCBvZiBhIE1lbnUgYXMgdGhlIHZhbHVlIG9mIGRhdGEtdGFiLWJhci4nKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLiR0YXJnZXRNZW51ID0gJChgIyR7dGFyZ2V0SUR9YCk7XHJcbiAgICB0aGlzLiR0b2dnbGVyID0gdGhpcy4kZWxlbWVudC5maW5kKCdbZGF0YS10b2dnbGVdJyk7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgdGhpcy5vcHRpb25zLCB0aGlzLiR0YXJnZXRNZW51LmRhdGEoKSk7XHJcblxyXG4gICAgLy8gSWYgdGhleSB3ZXJlIHNldCwgcGFyc2UgdGhlIGFuaW1hdGlvbiBjbGFzc2VzXHJcbiAgICBpZih0aGlzLm9wdGlvbnMuYW5pbWF0ZSkge1xyXG4gICAgICBsZXQgaW5wdXQgPSB0aGlzLm9wdGlvbnMuYW5pbWF0ZS5zcGxpdCgnICcpO1xyXG5cclxuICAgICAgdGhpcy5hbmltYXRpb25JbiA9IGlucHV0WzBdO1xyXG4gICAgICB0aGlzLmFuaW1hdGlvbk91dCA9IGlucHV0WzFdIHx8IG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5fdXBkYXRlKCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGRzIG5lY2Vzc2FyeSBldmVudCBoYW5kbGVycyBmb3IgdGhlIHRhYiBiYXIgdG8gd29yay5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9ldmVudHMoKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG5cclxuICAgIHRoaXMuX3VwZGF0ZU1xSGFuZGxlciA9IHRoaXMuX3VwZGF0ZS5iaW5kKHRoaXMpO1xyXG5cclxuICAgICQod2luZG93KS5vbignY2hhbmdlZC56Zi5tZWRpYXF1ZXJ5JywgdGhpcy5fdXBkYXRlTXFIYW5kbGVyKTtcclxuXHJcbiAgICB0aGlzLiR0b2dnbGVyLm9uKCdjbGljay56Zi5yZXNwb25zaXZlVG9nZ2xlJywgdGhpcy50b2dnbGVNZW51LmJpbmQodGhpcykpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2tzIHRoZSBjdXJyZW50IG1lZGlhIHF1ZXJ5IHRvIGRldGVybWluZSBpZiB0aGUgdGFiIGJhciBzaG91bGQgYmUgdmlzaWJsZSBvciBoaWRkZW4uXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfdXBkYXRlKCkge1xyXG4gICAgLy8gTW9iaWxlXHJcbiAgICBpZiAoIUZvdW5kYXRpb24uTWVkaWFRdWVyeS5hdExlYXN0KHRoaXMub3B0aW9ucy5oaWRlRm9yKSkge1xyXG4gICAgICB0aGlzLiRlbGVtZW50LnNob3coKTtcclxuICAgICAgdGhpcy4kdGFyZ2V0TWVudS5oaWRlKCk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gRGVza3RvcFxyXG4gICAgZWxzZSB7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQuaGlkZSgpO1xyXG4gICAgICB0aGlzLiR0YXJnZXRNZW51LnNob3coKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFRvZ2dsZXMgdGhlIGVsZW1lbnQgYXR0YWNoZWQgdG8gdGhlIHRhYiBiYXIuIFRoZSB0b2dnbGUgb25seSBoYXBwZW5zIGlmIHRoZSBzY3JlZW4gaXMgc21hbGwgZW5vdWdoIHRvIGFsbG93IGl0LlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBmaXJlcyBSZXNwb25zaXZlVG9nZ2xlI3RvZ2dsZWRcclxuICAgKi9cclxuICB0b2dnbGVNZW51KCkge1xyXG4gICAgaWYgKCFGb3VuZGF0aW9uLk1lZGlhUXVlcnkuYXRMZWFzdCh0aGlzLm9wdGlvbnMuaGlkZUZvcikpIHtcclxuICAgICAgaWYodGhpcy5vcHRpb25zLmFuaW1hdGUpIHtcclxuICAgICAgICBpZiAodGhpcy4kdGFyZ2V0TWVudS5pcygnOmhpZGRlbicpKSB7XHJcbiAgICAgICAgICBGb3VuZGF0aW9uLk1vdGlvbi5hbmltYXRlSW4odGhpcy4kdGFyZ2V0TWVudSwgdGhpcy5hbmltYXRpb25JbiwgKCkgPT4ge1xyXG4gICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgICogRmlyZXMgd2hlbiB0aGUgZWxlbWVudCBhdHRhY2hlZCB0byB0aGUgdGFiIGJhciB0b2dnbGVzLlxyXG4gICAgICAgICAgICAgKiBAZXZlbnQgUmVzcG9uc2l2ZVRvZ2dsZSN0b2dnbGVkXHJcbiAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ3RvZ2dsZWQuemYucmVzcG9uc2l2ZVRvZ2dsZScpO1xyXG4gICAgICAgICAgICB0aGlzLiR0YXJnZXRNZW51LmZpbmQoJ1tkYXRhLW11dGF0ZV0nKS50cmlnZ2VySGFuZGxlcignbXV0YXRlbWUuemYudHJpZ2dlcicpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgRm91bmRhdGlvbi5Nb3Rpb24uYW5pbWF0ZU91dCh0aGlzLiR0YXJnZXRNZW51LCB0aGlzLmFuaW1hdGlvbk91dCwgKCkgPT4ge1xyXG4gICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgICogRmlyZXMgd2hlbiB0aGUgZWxlbWVudCBhdHRhY2hlZCB0byB0aGUgdGFiIGJhciB0b2dnbGVzLlxyXG4gICAgICAgICAgICAgKiBAZXZlbnQgUmVzcG9uc2l2ZVRvZ2dsZSN0b2dnbGVkXHJcbiAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ3RvZ2dsZWQuemYucmVzcG9uc2l2ZVRvZ2dsZScpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIGVsc2Uge1xyXG4gICAgICAgIHRoaXMuJHRhcmdldE1lbnUudG9nZ2xlKDApO1xyXG4gICAgICAgIHRoaXMuJHRhcmdldE1lbnUuZmluZCgnW2RhdGEtbXV0YXRlXScpLnRyaWdnZXIoJ211dGF0ZW1lLnpmLnRyaWdnZXInKTtcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogRmlyZXMgd2hlbiB0aGUgZWxlbWVudCBhdHRhY2hlZCB0byB0aGUgdGFiIGJhciB0b2dnbGVzLlxyXG4gICAgICAgICAqIEBldmVudCBSZXNwb25zaXZlVG9nZ2xlI3RvZ2dsZWRcclxuICAgICAgICAgKi9cclxuICAgICAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ3RvZ2dsZWQuemYucmVzcG9uc2l2ZVRvZ2dsZScpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgZGVzdHJveSgpIHtcclxuICAgIHRoaXMuJGVsZW1lbnQub2ZmKCcuemYucmVzcG9uc2l2ZVRvZ2dsZScpO1xyXG4gICAgdGhpcy4kdG9nZ2xlci5vZmYoJy56Zi5yZXNwb25zaXZlVG9nZ2xlJyk7XHJcblxyXG4gICAgJCh3aW5kb3cpLm9mZignY2hhbmdlZC56Zi5tZWRpYXF1ZXJ5JywgdGhpcy5fdXBkYXRlTXFIYW5kbGVyKTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLnVucmVnaXN0ZXJQbHVnaW4odGhpcyk7XHJcbiAgfVxyXG59XHJcblxyXG5SZXNwb25zaXZlVG9nZ2xlLmRlZmF1bHRzID0ge1xyXG4gIC8qKlxyXG4gICAqIFRoZSBicmVha3BvaW50IGFmdGVyIHdoaWNoIHRoZSBtZW51IGlzIGFsd2F5cyBzaG93biwgYW5kIHRoZSB0YWIgYmFyIGlzIGhpZGRlbi5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ21lZGl1bSdcclxuICAgKi9cclxuICBoaWRlRm9yOiAnbWVkaXVtJyxcclxuXHJcbiAgLyoqXHJcbiAgICogVG8gZGVjaWRlIGlmIHRoZSB0b2dnbGUgc2hvdWxkIGJlIGFuaW1hdGVkIG9yIG5vdC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBhbmltYXRlOiBmYWxzZVxyXG59O1xyXG5cclxuLy8gV2luZG93IGV4cG9ydHNcclxuRm91bmRhdGlvbi5wbHVnaW4oUmVzcG9uc2l2ZVRvZ2dsZSwgJ1Jlc3BvbnNpdmVUb2dnbGUnKTtcclxuXHJcbn0oalF1ZXJ5KTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuIWZ1bmN0aW9uKCQpIHtcclxuXHJcbi8qKlxyXG4gKiBSZXZlYWwgbW9kdWxlLlxyXG4gKiBAbW9kdWxlIGZvdW5kYXRpb24ucmV2ZWFsXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwua2V5Ym9hcmRcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5ib3hcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC50cmlnZ2Vyc1xyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLm1lZGlhUXVlcnlcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5tb3Rpb24gaWYgdXNpbmcgYW5pbWF0aW9uc1xyXG4gKi9cclxuXHJcbmNsYXNzIFJldmVhbCB7XHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlcyBhIG5ldyBpbnN0YW5jZSBvZiBSZXZlYWwuXHJcbiAgICogQGNsYXNzXHJcbiAgICogQHBhcmFtIHtqUXVlcnl9IGVsZW1lbnQgLSBqUXVlcnkgb2JqZWN0IHRvIHVzZSBmb3IgdGhlIG1vZGFsLlxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIC0gb3B0aW9uYWwgcGFyYW1ldGVycy5cclxuICAgKi9cclxuICBjb25zdHJ1Y3RvcihlbGVtZW50LCBvcHRpb25zKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50ID0gZWxlbWVudDtcclxuICAgIHRoaXMub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBSZXZlYWwuZGVmYXVsdHMsIHRoaXMuJGVsZW1lbnQuZGF0YSgpLCBvcHRpb25zKTtcclxuICAgIHRoaXMuX2luaXQoKTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLnJlZ2lzdGVyUGx1Z2luKHRoaXMsICdSZXZlYWwnKTtcclxuICAgIEZvdW5kYXRpb24uS2V5Ym9hcmQucmVnaXN0ZXIoJ1JldmVhbCcsIHtcclxuICAgICAgJ0VOVEVSJzogJ29wZW4nLFxyXG4gICAgICAnU1BBQ0UnOiAnb3BlbicsXHJcbiAgICAgICdFU0NBUEUnOiAnY2xvc2UnLFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJbml0aWFsaXplcyB0aGUgbW9kYWwgYnkgYWRkaW5nIHRoZSBvdmVybGF5IGFuZCBjbG9zZSBidXR0b25zLCAoaWYgc2VsZWN0ZWQpLlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2luaXQoKSB7XHJcbiAgICB0aGlzLmlkID0gdGhpcy4kZWxlbWVudC5hdHRyKCdpZCcpO1xyXG4gICAgdGhpcy5pc0FjdGl2ZSA9IGZhbHNlO1xyXG4gICAgdGhpcy5jYWNoZWQgPSB7bXE6IEZvdW5kYXRpb24uTWVkaWFRdWVyeS5jdXJyZW50fTtcclxuICAgIHRoaXMuaXNNb2JpbGUgPSBtb2JpbGVTbmlmZigpO1xyXG5cclxuICAgIHRoaXMuJGFuY2hvciA9ICQoYFtkYXRhLW9wZW49XCIke3RoaXMuaWR9XCJdYCkubGVuZ3RoID8gJChgW2RhdGEtb3Blbj1cIiR7dGhpcy5pZH1cIl1gKSA6ICQoYFtkYXRhLXRvZ2dsZT1cIiR7dGhpcy5pZH1cIl1gKTtcclxuICAgIHRoaXMuJGFuY2hvci5hdHRyKHtcclxuICAgICAgJ2FyaWEtY29udHJvbHMnOiB0aGlzLmlkLFxyXG4gICAgICAnYXJpYS1oYXNwb3B1cCc6IHRydWUsXHJcbiAgICAgICd0YWJpbmRleCc6IDBcclxuICAgIH0pO1xyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMuZnVsbFNjcmVlbiB8fCB0aGlzLiRlbGVtZW50Lmhhc0NsYXNzKCdmdWxsJykpIHtcclxuICAgICAgdGhpcy5vcHRpb25zLmZ1bGxTY3JlZW4gPSB0cnVlO1xyXG4gICAgICB0aGlzLm9wdGlvbnMub3ZlcmxheSA9IGZhbHNlO1xyXG4gICAgfVxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5vdmVybGF5ICYmICF0aGlzLiRvdmVybGF5KSB7XHJcbiAgICAgIHRoaXMuJG92ZXJsYXkgPSB0aGlzLl9tYWtlT3ZlcmxheSh0aGlzLmlkKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLiRlbGVtZW50LmF0dHIoe1xyXG4gICAgICAgICdyb2xlJzogJ2RpYWxvZycsXHJcbiAgICAgICAgJ2FyaWEtaGlkZGVuJzogdHJ1ZSxcclxuICAgICAgICAnZGF0YS15ZXRpLWJveCc6IHRoaXMuaWQsXHJcbiAgICAgICAgJ2RhdGEtcmVzaXplJzogdGhpcy5pZFxyXG4gICAgfSk7XHJcblxyXG4gICAgaWYodGhpcy4kb3ZlcmxheSkge1xyXG4gICAgICB0aGlzLiRlbGVtZW50LmRldGFjaCgpLmFwcGVuZFRvKHRoaXMuJG92ZXJsYXkpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy4kZWxlbWVudC5kZXRhY2goKS5hcHBlbmRUbygkKHRoaXMub3B0aW9ucy5hcHBlbmRUbykpO1xyXG4gICAgICB0aGlzLiRlbGVtZW50LmFkZENsYXNzKCd3aXRob3V0LW92ZXJsYXknKTtcclxuICAgIH1cclxuICAgIHRoaXMuX2V2ZW50cygpO1xyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5kZWVwTGluayAmJiB3aW5kb3cubG9jYXRpb24uaGFzaCA9PT0gKCBgIyR7dGhpcy5pZH1gKSkge1xyXG4gICAgICAkKHdpbmRvdykub25lKCdsb2FkLnpmLnJldmVhbCcsIHRoaXMub3Blbi5iaW5kKHRoaXMpKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZXMgYW4gb3ZlcmxheSBkaXYgdG8gZGlzcGxheSBiZWhpbmQgdGhlIG1vZGFsLlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX21ha2VPdmVybGF5KCkge1xyXG4gICAgcmV0dXJuICQoJzxkaXY+PC9kaXY+JylcclxuICAgICAgLmFkZENsYXNzKCdyZXZlYWwtb3ZlcmxheScpXHJcbiAgICAgIC5hcHBlbmRUbyh0aGlzLm9wdGlvbnMuYXBwZW5kVG8pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVXBkYXRlcyBwb3NpdGlvbiBvZiBtb2RhbFxyXG4gICAqIFRPRE86ICBGaWd1cmUgb3V0IGlmIHdlIGFjdHVhbGx5IG5lZWQgdG8gY2FjaGUgdGhlc2UgdmFsdWVzIG9yIGlmIGl0IGRvZXNuJ3QgbWF0dGVyXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfdXBkYXRlUG9zaXRpb24oKSB7XHJcbiAgICB2YXIgd2lkdGggPSB0aGlzLiRlbGVtZW50Lm91dGVyV2lkdGgoKTtcclxuICAgIHZhciBvdXRlcldpZHRoID0gJCh3aW5kb3cpLndpZHRoKCk7XHJcbiAgICB2YXIgaGVpZ2h0ID0gdGhpcy4kZWxlbWVudC5vdXRlckhlaWdodCgpO1xyXG4gICAgdmFyIG91dGVySGVpZ2h0ID0gJCh3aW5kb3cpLmhlaWdodCgpO1xyXG4gICAgdmFyIGxlZnQsIHRvcDtcclxuICAgIGlmICh0aGlzLm9wdGlvbnMuaE9mZnNldCA9PT0gJ2F1dG8nKSB7XHJcbiAgICAgIGxlZnQgPSBwYXJzZUludCgob3V0ZXJXaWR0aCAtIHdpZHRoKSAvIDIsIDEwKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGxlZnQgPSBwYXJzZUludCh0aGlzLm9wdGlvbnMuaE9mZnNldCwgMTApO1xyXG4gICAgfVxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy52T2Zmc2V0ID09PSAnYXV0bycpIHtcclxuICAgICAgaWYgKGhlaWdodCA+IG91dGVySGVpZ2h0KSB7XHJcbiAgICAgICAgdG9wID0gcGFyc2VJbnQoTWF0aC5taW4oMTAwLCBvdXRlckhlaWdodCAvIDEwKSwgMTApO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRvcCA9IHBhcnNlSW50KChvdXRlckhlaWdodCAtIGhlaWdodCkgLyA0LCAxMCk7XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRvcCA9IHBhcnNlSW50KHRoaXMub3B0aW9ucy52T2Zmc2V0LCAxMCk7XHJcbiAgICB9XHJcbiAgICB0aGlzLiRlbGVtZW50LmNzcyh7dG9wOiB0b3AgKyAncHgnfSk7XHJcbiAgICAvLyBvbmx5IHdvcnJ5IGFib3V0IGxlZnQgaWYgd2UgZG9uJ3QgaGF2ZSBhbiBvdmVybGF5IG9yIHdlIGhhdmVhICBob3Jpem9udGFsIG9mZnNldCxcclxuICAgIC8vIG90aGVyd2lzZSB3ZSdyZSBwZXJmZWN0bHkgaW4gdGhlIG1pZGRsZVxyXG4gICAgaWYoIXRoaXMuJG92ZXJsYXkgfHwgKHRoaXMub3B0aW9ucy5oT2Zmc2V0ICE9PSAnYXV0bycpKSB7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQuY3NzKHtsZWZ0OiBsZWZ0ICsgJ3B4J30pO1xyXG4gICAgICB0aGlzLiRlbGVtZW50LmNzcyh7bWFyZ2luOiAnMHB4J30pO1xyXG4gICAgfVxyXG5cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMgZXZlbnQgaGFuZGxlcnMgZm9yIHRoZSBtb2RhbC5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9ldmVudHMoKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG5cclxuICAgIHRoaXMuJGVsZW1lbnQub24oe1xyXG4gICAgICAnb3Blbi56Zi50cmlnZ2VyJzogdGhpcy5vcGVuLmJpbmQodGhpcyksXHJcbiAgICAgICdjbG9zZS56Zi50cmlnZ2VyJzogKGV2ZW50LCAkZWxlbWVudCkgPT4ge1xyXG4gICAgICAgIGlmICgoZXZlbnQudGFyZ2V0ID09PSBfdGhpcy4kZWxlbWVudFswXSkgfHxcclxuICAgICAgICAgICAgKCQoZXZlbnQudGFyZ2V0KS5wYXJlbnRzKCdbZGF0YS1jbG9zYWJsZV0nKVswXSA9PT0gJGVsZW1lbnQpKSB7IC8vIG9ubHkgY2xvc2UgcmV2ZWFsIHdoZW4gaXQncyBleHBsaWNpdGx5IGNhbGxlZFxyXG4gICAgICAgICAgcmV0dXJuIHRoaXMuY2xvc2UuYXBwbHkodGhpcyk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICAndG9nZ2xlLnpmLnRyaWdnZXInOiB0aGlzLnRvZ2dsZS5iaW5kKHRoaXMpLFxyXG4gICAgICAncmVzaXplbWUuemYudHJpZ2dlcic6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIF90aGlzLl91cGRhdGVQb3NpdGlvbigpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICBpZiAodGhpcy4kYW5jaG9yLmxlbmd0aCkge1xyXG4gICAgICB0aGlzLiRhbmNob3Iub24oJ2tleWRvd24uemYucmV2ZWFsJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGlmIChlLndoaWNoID09PSAxMyB8fCBlLndoaWNoID09PSAzMikge1xyXG4gICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgIF90aGlzLm9wZW4oKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMuY2xvc2VPbkNsaWNrICYmIHRoaXMub3B0aW9ucy5vdmVybGF5KSB7XHJcbiAgICAgIHRoaXMuJG92ZXJsYXkub2ZmKCcuemYucmV2ZWFsJykub24oJ2NsaWNrLnpmLnJldmVhbCcsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBpZiAoZS50YXJnZXQgPT09IF90aGlzLiRlbGVtZW50WzBdIHx8XHJcbiAgICAgICAgICAkLmNvbnRhaW5zKF90aGlzLiRlbGVtZW50WzBdLCBlLnRhcmdldCkgfHxcclxuICAgICAgICAgICAgISQuY29udGFpbnMoZG9jdW1lbnQsIGUudGFyZ2V0KSkge1xyXG4gICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgX3RoaXMuY2xvc2UoKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmRlZXBMaW5rKSB7XHJcbiAgICAgICQod2luZG93KS5vbihgcG9wc3RhdGUuemYucmV2ZWFsOiR7dGhpcy5pZH1gLCB0aGlzLl9oYW5kbGVTdGF0ZS5iaW5kKHRoaXMpKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZXMgbW9kYWwgbWV0aG9kcyBvbiBiYWNrL2ZvcndhcmQgYnV0dG9uIGNsaWNrcyBvciBhbnkgb3RoZXIgZXZlbnQgdGhhdCB0cmlnZ2VycyBwb3BzdGF0ZS5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9oYW5kbGVTdGF0ZShlKSB7XHJcbiAgICBpZih3aW5kb3cubG9jYXRpb24uaGFzaCA9PT0gKCAnIycgKyB0aGlzLmlkKSAmJiAhdGhpcy5pc0FjdGl2ZSl7IHRoaXMub3BlbigpOyB9XHJcbiAgICBlbHNleyB0aGlzLmNsb3NlKCk7IH1cclxuICB9XHJcblxyXG5cclxuICAvKipcclxuICAgKiBPcGVucyB0aGUgbW9kYWwgY29udHJvbGxlZCBieSBgdGhpcy4kYW5jaG9yYCwgYW5kIGNsb3NlcyBhbGwgb3RoZXJzIGJ5IGRlZmF1bHQuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQGZpcmVzIFJldmVhbCNjbG9zZW1lXHJcbiAgICogQGZpcmVzIFJldmVhbCNvcGVuXHJcbiAgICovXHJcbiAgb3BlbigpIHtcclxuICAgIGlmICh0aGlzLm9wdGlvbnMuZGVlcExpbmspIHtcclxuICAgICAgdmFyIGhhc2ggPSBgIyR7dGhpcy5pZH1gO1xyXG5cclxuICAgICAgaWYgKHdpbmRvdy5oaXN0b3J5LnB1c2hTdGF0ZSkge1xyXG4gICAgICAgIHdpbmRvdy5oaXN0b3J5LnB1c2hTdGF0ZShudWxsLCBudWxsLCBoYXNoKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICB3aW5kb3cubG9jYXRpb24uaGFzaCA9IGhhc2g7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmlzQWN0aXZlID0gdHJ1ZTtcclxuXHJcbiAgICAvLyBNYWtlIGVsZW1lbnRzIGludmlzaWJsZSwgYnV0IHJlbW92ZSBkaXNwbGF5OiBub25lIHNvIHdlIGNhbiBnZXQgc2l6ZSBhbmQgcG9zaXRpb25pbmdcclxuICAgIHRoaXMuJGVsZW1lbnRcclxuICAgICAgICAuY3NzKHsgJ3Zpc2liaWxpdHknOiAnaGlkZGVuJyB9KVxyXG4gICAgICAgIC5zaG93KClcclxuICAgICAgICAuc2Nyb2xsVG9wKDApO1xyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5vdmVybGF5KSB7XHJcbiAgICAgIHRoaXMuJG92ZXJsYXkuY3NzKHsndmlzaWJpbGl0eSc6ICdoaWRkZW4nfSkuc2hvdygpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuX3VwZGF0ZVBvc2l0aW9uKCk7XHJcblxyXG4gICAgdGhpcy4kZWxlbWVudFxyXG4gICAgICAuaGlkZSgpXHJcbiAgICAgIC5jc3MoeyAndmlzaWJpbGl0eSc6ICcnIH0pO1xyXG5cclxuICAgIGlmKHRoaXMuJG92ZXJsYXkpIHtcclxuICAgICAgdGhpcy4kb3ZlcmxheS5jc3Moeyd2aXNpYmlsaXR5JzogJyd9KS5oaWRlKCk7XHJcbiAgICAgIGlmKHRoaXMuJGVsZW1lbnQuaGFzQ2xhc3MoJ2Zhc3QnKSkge1xyXG4gICAgICAgIHRoaXMuJG92ZXJsYXkuYWRkQ2xhc3MoJ2Zhc3QnKTtcclxuICAgICAgfSBlbHNlIGlmICh0aGlzLiRlbGVtZW50Lmhhc0NsYXNzKCdzbG93JykpIHtcclxuICAgICAgICB0aGlzLiRvdmVybGF5LmFkZENsYXNzKCdzbG93Jyk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcblxyXG4gICAgaWYgKCF0aGlzLm9wdGlvbnMubXVsdGlwbGVPcGVuZWQpIHtcclxuICAgICAgLyoqXHJcbiAgICAgICAqIEZpcmVzIGltbWVkaWF0ZWx5IGJlZm9yZSB0aGUgbW9kYWwgb3BlbnMuXHJcbiAgICAgICAqIENsb3NlcyBhbnkgb3RoZXIgbW9kYWxzIHRoYXQgYXJlIGN1cnJlbnRseSBvcGVuXHJcbiAgICAgICAqIEBldmVudCBSZXZlYWwjY2xvc2VtZVxyXG4gICAgICAgKi9cclxuICAgICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdjbG9zZW1lLnpmLnJldmVhbCcsIHRoaXMuaWQpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcblxyXG4gICAgZnVuY3Rpb24gYWRkUmV2ZWFsT3BlbkNsYXNzZXMoKSB7XHJcbiAgICAgIGlmIChfdGhpcy5pc01vYmlsZSkge1xyXG4gICAgICAgIGlmKCFfdGhpcy5vcmlnaW5hbFNjcm9sbFBvcykge1xyXG4gICAgICAgICAgX3RoaXMub3JpZ2luYWxTY3JvbGxQb3MgPSB3aW5kb3cucGFnZVlPZmZzZXQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgICQoJ2h0bWwsIGJvZHknKS5hZGRDbGFzcygnaXMtcmV2ZWFsLW9wZW4nKTtcclxuICAgICAgfVxyXG4gICAgICBlbHNlIHtcclxuICAgICAgICAkKCdib2R5JykuYWRkQ2xhc3MoJ2lzLXJldmVhbC1vcGVuJyk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIC8vIE1vdGlvbiBVSSBtZXRob2Qgb2YgcmV2ZWFsXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmFuaW1hdGlvbkluKSB7XHJcbiAgICAgIGZ1bmN0aW9uIGFmdGVyQW5pbWF0aW9uKCl7XHJcbiAgICAgICAgX3RoaXMuJGVsZW1lbnRcclxuICAgICAgICAgIC5hdHRyKHtcclxuICAgICAgICAgICAgJ2FyaWEtaGlkZGVuJzogZmFsc2UsXHJcbiAgICAgICAgICAgICd0YWJpbmRleCc6IC0xXHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgICAgLmZvY3VzKCk7XHJcbiAgICAgICAgYWRkUmV2ZWFsT3BlbkNsYXNzZXMoKTtcclxuICAgICAgICBGb3VuZGF0aW9uLktleWJvYXJkLnRyYXBGb2N1cyhfdGhpcy4kZWxlbWVudCk7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5vdmVybGF5KSB7XHJcbiAgICAgICAgRm91bmRhdGlvbi5Nb3Rpb24uYW5pbWF0ZUluKHRoaXMuJG92ZXJsYXksICdmYWRlLWluJyk7XHJcbiAgICAgIH1cclxuICAgICAgRm91bmRhdGlvbi5Nb3Rpb24uYW5pbWF0ZUluKHRoaXMuJGVsZW1lbnQsIHRoaXMub3B0aW9ucy5hbmltYXRpb25JbiwgKCkgPT4ge1xyXG4gICAgICAgIGlmKHRoaXMuJGVsZW1lbnQpIHsgLy8gcHJvdGVjdCBhZ2FpbnN0IG9iamVjdCBoYXZpbmcgYmVlbiByZW1vdmVkXHJcbiAgICAgICAgICB0aGlzLmZvY3VzYWJsZUVsZW1lbnRzID0gRm91bmRhdGlvbi5LZXlib2FyZC5maW5kRm9jdXNhYmxlKHRoaXMuJGVsZW1lbnQpO1xyXG4gICAgICAgICAgYWZ0ZXJBbmltYXRpb24oKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgLy8galF1ZXJ5IG1ldGhvZCBvZiByZXZlYWxcclxuICAgIGVsc2Uge1xyXG4gICAgICBpZiAodGhpcy5vcHRpb25zLm92ZXJsYXkpIHtcclxuICAgICAgICB0aGlzLiRvdmVybGF5LnNob3coMCk7XHJcbiAgICAgIH1cclxuICAgICAgdGhpcy4kZWxlbWVudC5zaG93KHRoaXMub3B0aW9ucy5zaG93RGVsYXkpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIGhhbmRsZSBhY2Nlc3NpYmlsaXR5XHJcbiAgICB0aGlzLiRlbGVtZW50XHJcbiAgICAgIC5hdHRyKHtcclxuICAgICAgICAnYXJpYS1oaWRkZW4nOiBmYWxzZSxcclxuICAgICAgICAndGFiaW5kZXgnOiAtMVxyXG4gICAgICB9KVxyXG4gICAgICAuZm9jdXMoKTtcclxuICAgIEZvdW5kYXRpb24uS2V5Ym9hcmQudHJhcEZvY3VzKHRoaXMuJGVsZW1lbnQpO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogRmlyZXMgd2hlbiB0aGUgbW9kYWwgaGFzIHN1Y2Nlc3NmdWxseSBvcGVuZWQuXHJcbiAgICAgKiBAZXZlbnQgUmV2ZWFsI29wZW5cclxuICAgICAqL1xyXG4gICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdvcGVuLnpmLnJldmVhbCcpO1xyXG5cclxuICAgIGFkZFJldmVhbE9wZW5DbGFzc2VzKCk7XHJcblxyXG4gICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgIHRoaXMuX2V4dHJhSGFuZGxlcnMoKTtcclxuICAgIH0sIDApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBleHRyYSBldmVudCBoYW5kbGVycyBmb3IgdGhlIGJvZHkgYW5kIHdpbmRvdyBpZiBuZWNlc3NhcnkuXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfZXh0cmFIYW5kbGVycygpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICBpZighdGhpcy4kZWxlbWVudCkgeyByZXR1cm47IH0gLy8gSWYgd2UncmUgaW4gdGhlIG1pZGRsZSBvZiBjbGVhbnVwLCBkb24ndCBmcmVhayBvdXRcclxuICAgIHRoaXMuZm9jdXNhYmxlRWxlbWVudHMgPSBGb3VuZGF0aW9uLktleWJvYXJkLmZpbmRGb2N1c2FibGUodGhpcy4kZWxlbWVudCk7XHJcblxyXG4gICAgaWYgKCF0aGlzLm9wdGlvbnMub3ZlcmxheSAmJiB0aGlzLm9wdGlvbnMuY2xvc2VPbkNsaWNrICYmICF0aGlzLm9wdGlvbnMuZnVsbFNjcmVlbikge1xyXG4gICAgICAkKCdib2R5Jykub24oJ2NsaWNrLnpmLnJldmVhbCcsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBpZiAoZS50YXJnZXQgPT09IF90aGlzLiRlbGVtZW50WzBdIHx8XHJcbiAgICAgICAgICAkLmNvbnRhaW5zKF90aGlzLiRlbGVtZW50WzBdLCBlLnRhcmdldCkgfHxcclxuICAgICAgICAgICAgISQuY29udGFpbnMoZG9jdW1lbnQsIGUudGFyZ2V0KSkgeyByZXR1cm47IH1cclxuICAgICAgICBfdGhpcy5jbG9zZSgpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmNsb3NlT25Fc2MpIHtcclxuICAgICAgJCh3aW5kb3cpLm9uKCdrZXlkb3duLnpmLnJldmVhbCcsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBGb3VuZGF0aW9uLktleWJvYXJkLmhhbmRsZUtleShlLCAnUmV2ZWFsJywge1xyXG4gICAgICAgICAgY2xvc2U6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICBpZiAoX3RoaXMub3B0aW9ucy5jbG9zZU9uRXNjKSB7XHJcbiAgICAgICAgICAgICAgX3RoaXMuY2xvc2UoKTtcclxuICAgICAgICAgICAgICBfdGhpcy4kYW5jaG9yLmZvY3VzKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gbG9jayBmb2N1cyB3aXRoaW4gbW9kYWwgd2hpbGUgdGFiYmluZ1xyXG4gICAgdGhpcy4kZWxlbWVudC5vbigna2V5ZG93bi56Zi5yZXZlYWwnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgIHZhciAkdGFyZ2V0ID0gJCh0aGlzKTtcclxuICAgICAgLy8gaGFuZGxlIGtleWJvYXJkIGV2ZW50IHdpdGgga2V5Ym9hcmQgdXRpbFxyXG4gICAgICBGb3VuZGF0aW9uLktleWJvYXJkLmhhbmRsZUtleShlLCAnUmV2ZWFsJywge1xyXG4gICAgICAgIG9wZW46IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgaWYgKF90aGlzLiRlbGVtZW50LmZpbmQoJzpmb2N1cycpLmlzKF90aGlzLiRlbGVtZW50LmZpbmQoJ1tkYXRhLWNsb3NlXScpKSkge1xyXG4gICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkgeyAvLyBzZXQgZm9jdXMgYmFjayB0byBhbmNob3IgaWYgY2xvc2UgYnV0dG9uIGhhcyBiZWVuIGFjdGl2YXRlZFxyXG4gICAgICAgICAgICAgIF90aGlzLiRhbmNob3IuZm9jdXMoKTtcclxuICAgICAgICAgICAgfSwgMSk7XHJcbiAgICAgICAgICB9IGVsc2UgaWYgKCR0YXJnZXQuaXMoX3RoaXMuZm9jdXNhYmxlRWxlbWVudHMpKSB7IC8vIGRvbnQndCB0cmlnZ2VyIGlmIGFjdWFsIGVsZW1lbnQgaGFzIGZvY3VzIChpLmUuIGlucHV0cywgbGlua3MsIC4uLilcclxuICAgICAgICAgICAgX3RoaXMub3BlbigpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgY2xvc2U6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgaWYgKF90aGlzLm9wdGlvbnMuY2xvc2VPbkVzYykge1xyXG4gICAgICAgICAgICBfdGhpcy5jbG9zZSgpO1xyXG4gICAgICAgICAgICBfdGhpcy4kYW5jaG9yLmZvY3VzKCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICBoYW5kbGVkOiBmdW5jdGlvbihwcmV2ZW50RGVmYXVsdCkge1xyXG4gICAgICAgICAgaWYgKHByZXZlbnREZWZhdWx0KSB7XHJcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDbG9zZXMgdGhlIG1vZGFsLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBmaXJlcyBSZXZlYWwjY2xvc2VkXHJcbiAgICovXHJcbiAgY2xvc2UoKSB7XHJcbiAgICBpZiAoIXRoaXMuaXNBY3RpdmUgfHwgIXRoaXMuJGVsZW1lbnQuaXMoJzp2aXNpYmxlJykpIHtcclxuICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuXHJcbiAgICAvLyBNb3Rpb24gVUkgbWV0aG9kIG9mIGhpZGluZ1xyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5hbmltYXRpb25PdXQpIHtcclxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5vdmVybGF5KSB7XHJcbiAgICAgICAgRm91bmRhdGlvbi5Nb3Rpb24uYW5pbWF0ZU91dCh0aGlzLiRvdmVybGF5LCAnZmFkZS1vdXQnLCBmaW5pc2hVcCk7XHJcbiAgICAgIH1cclxuICAgICAgZWxzZSB7XHJcbiAgICAgICAgZmluaXNoVXAoKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgRm91bmRhdGlvbi5Nb3Rpb24uYW5pbWF0ZU91dCh0aGlzLiRlbGVtZW50LCB0aGlzLm9wdGlvbnMuYW5pbWF0aW9uT3V0KTtcclxuICAgIH1cclxuICAgIC8vIGpRdWVyeSBtZXRob2Qgb2YgaGlkaW5nXHJcbiAgICBlbHNlIHtcclxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5vdmVybGF5KSB7XHJcbiAgICAgICAgdGhpcy4kb3ZlcmxheS5oaWRlKDAsIGZpbmlzaFVwKTtcclxuICAgICAgfVxyXG4gICAgICBlbHNlIHtcclxuICAgICAgICBmaW5pc2hVcCgpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICB0aGlzLiRlbGVtZW50LmhpZGUodGhpcy5vcHRpb25zLmhpZGVEZWxheSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gQ29uZGl0aW9uYWxzIHRvIHJlbW92ZSBleHRyYSBldmVudCBsaXN0ZW5lcnMgYWRkZWQgb24gb3BlblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5jbG9zZU9uRXNjKSB7XHJcbiAgICAgICQod2luZG93KS5vZmYoJ2tleWRvd24uemYucmV2ZWFsJyk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCF0aGlzLm9wdGlvbnMub3ZlcmxheSAmJiB0aGlzLm9wdGlvbnMuY2xvc2VPbkNsaWNrKSB7XHJcbiAgICAgICQoJ2JvZHknKS5vZmYoJ2NsaWNrLnpmLnJldmVhbCcpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuJGVsZW1lbnQub2ZmKCdrZXlkb3duLnpmLnJldmVhbCcpO1xyXG5cclxuICAgIGZ1bmN0aW9uIGZpbmlzaFVwKCkge1xyXG4gICAgICBpZiAoX3RoaXMuaXNNb2JpbGUpIHtcclxuICAgICAgICAkKCdodG1sLCBib2R5JykucmVtb3ZlQ2xhc3MoJ2lzLXJldmVhbC1vcGVuJyk7XHJcbiAgICAgICAgaWYoX3RoaXMub3JpZ2luYWxTY3JvbGxQb3MpIHtcclxuICAgICAgICAgICQoJ2JvZHknKS5zY3JvbGxUb3AoX3RoaXMub3JpZ2luYWxTY3JvbGxQb3MpO1xyXG4gICAgICAgICAgX3RoaXMub3JpZ2luYWxTY3JvbGxQb3MgPSBudWxsO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBlbHNlIHtcclxuICAgICAgICAkKCdib2R5JykucmVtb3ZlQ2xhc3MoJ2lzLXJldmVhbC1vcGVuJyk7XHJcbiAgICAgIH1cclxuXHJcblxyXG4gICAgICBGb3VuZGF0aW9uLktleWJvYXJkLnJlbGVhc2VGb2N1cyhfdGhpcy4kZWxlbWVudCk7XHJcblxyXG4gICAgICBfdGhpcy4kZWxlbWVudC5hdHRyKCdhcmlhLWhpZGRlbicsIHRydWUpO1xyXG5cclxuICAgICAgLyoqXHJcbiAgICAgICogRmlyZXMgd2hlbiB0aGUgbW9kYWwgaXMgZG9uZSBjbG9zaW5nLlxyXG4gICAgICAqIEBldmVudCBSZXZlYWwjY2xvc2VkXHJcbiAgICAgICovXHJcbiAgICAgIF90aGlzLiRlbGVtZW50LnRyaWdnZXIoJ2Nsb3NlZC56Zi5yZXZlYWwnKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICogUmVzZXRzIHRoZSBtb2RhbCBjb250ZW50XHJcbiAgICAqIFRoaXMgcHJldmVudHMgYSBydW5uaW5nIHZpZGVvIHRvIGtlZXAgZ29pbmcgaW4gdGhlIGJhY2tncm91bmRcclxuICAgICovXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLnJlc2V0T25DbG9zZSkge1xyXG4gICAgICB0aGlzLiRlbGVtZW50Lmh0bWwodGhpcy4kZWxlbWVudC5odG1sKCkpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuaXNBY3RpdmUgPSBmYWxzZTtcclxuICAgICBpZiAoX3RoaXMub3B0aW9ucy5kZWVwTGluaykge1xyXG4gICAgICAgaWYgKHdpbmRvdy5oaXN0b3J5LnJlcGxhY2VTdGF0ZSkge1xyXG4gICAgICAgICB3aW5kb3cuaGlzdG9yeS5yZXBsYWNlU3RhdGUoJycsIGRvY3VtZW50LnRpdGxlLCB3aW5kb3cubG9jYXRpb24uaHJlZi5yZXBsYWNlKGAjJHt0aGlzLmlkfWAsICcnKSk7XHJcbiAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICB3aW5kb3cubG9jYXRpb24uaGFzaCA9ICcnO1xyXG4gICAgICAgfVxyXG4gICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFRvZ2dsZXMgdGhlIG9wZW4vY2xvc2VkIHN0YXRlIG9mIGEgbW9kYWwuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgdG9nZ2xlKCkge1xyXG4gICAgaWYgKHRoaXMuaXNBY3RpdmUpIHtcclxuICAgICAgdGhpcy5jbG9zZSgpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5vcGVuKCk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgLyoqXHJcbiAgICogRGVzdHJveXMgYW4gaW5zdGFuY2Ugb2YgYSBtb2RhbC5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICBkZXN0cm95KCkge1xyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5vdmVybGF5KSB7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQuYXBwZW5kVG8oJCh0aGlzLm9wdGlvbnMuYXBwZW5kVG8pKTsgLy8gbW92ZSAkZWxlbWVudCBvdXRzaWRlIG9mICRvdmVybGF5IHRvIHByZXZlbnQgZXJyb3IgdW5yZWdpc3RlclBsdWdpbigpXHJcbiAgICAgIHRoaXMuJG92ZXJsYXkuaGlkZSgpLm9mZigpLnJlbW92ZSgpO1xyXG4gICAgfVxyXG4gICAgdGhpcy4kZWxlbWVudC5oaWRlKCkub2ZmKCk7XHJcbiAgICB0aGlzLiRhbmNob3Iub2ZmKCcuemYnKTtcclxuICAgICQod2luZG93KS5vZmYoYC56Zi5yZXZlYWw6JHt0aGlzLmlkfWApO1xyXG5cclxuICAgIEZvdW5kYXRpb24udW5yZWdpc3RlclBsdWdpbih0aGlzKTtcclxuICB9O1xyXG59XHJcblxyXG5SZXZlYWwuZGVmYXVsdHMgPSB7XHJcbiAgLyoqXHJcbiAgICogTW90aW9uLVVJIGNsYXNzIHRvIHVzZSBmb3IgYW5pbWF0ZWQgZWxlbWVudHMuIElmIG5vbmUgdXNlZCwgZGVmYXVsdHMgdG8gc2ltcGxlIHNob3cvaGlkZS5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ3NsaWRlLWluLWxlZnQnXHJcbiAgICovXHJcbiAgYW5pbWF0aW9uSW46ICcnLFxyXG4gIC8qKlxyXG4gICAqIE1vdGlvbi1VSSBjbGFzcyB0byB1c2UgZm9yIGFuaW1hdGVkIGVsZW1lbnRzLiBJZiBub25lIHVzZWQsIGRlZmF1bHRzIHRvIHNpbXBsZSBzaG93L2hpZGUuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICdzbGlkZS1vdXQtcmlnaHQnXHJcbiAgICovXHJcbiAgYW5pbWF0aW9uT3V0OiAnJyxcclxuICAvKipcclxuICAgKiBUaW1lLCBpbiBtcywgdG8gZGVsYXkgdGhlIG9wZW5pbmcgb2YgYSBtb2RhbCBhZnRlciBhIGNsaWNrIGlmIG5vIGFuaW1hdGlvbiB1c2VkLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAxMFxyXG4gICAqL1xyXG4gIHNob3dEZWxheTogMCxcclxuICAvKipcclxuICAgKiBUaW1lLCBpbiBtcywgdG8gZGVsYXkgdGhlIGNsb3Npbmcgb2YgYSBtb2RhbCBhZnRlciBhIGNsaWNrIGlmIG5vIGFuaW1hdGlvbiB1c2VkLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAxMFxyXG4gICAqL1xyXG4gIGhpZGVEZWxheTogMCxcclxuICAvKipcclxuICAgKiBBbGxvd3MgYSBjbGljayBvbiB0aGUgYm9keS9vdmVybGF5IHRvIGNsb3NlIHRoZSBtb2RhbC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgdHJ1ZVxyXG4gICAqL1xyXG4gIGNsb3NlT25DbGljazogdHJ1ZSxcclxuICAvKipcclxuICAgKiBBbGxvd3MgdGhlIG1vZGFsIHRvIGNsb3NlIGlmIHRoZSB1c2VyIHByZXNzZXMgdGhlIGBFU0NBUEVgIGtleS5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgdHJ1ZVxyXG4gICAqL1xyXG4gIGNsb3NlT25Fc2M6IHRydWUsXHJcbiAgLyoqXHJcbiAgICogSWYgdHJ1ZSwgYWxsb3dzIG11bHRpcGxlIG1vZGFscyB0byBiZSBkaXNwbGF5ZWQgYXQgb25jZS5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBtdWx0aXBsZU9wZW5lZDogZmFsc2UsXHJcbiAgLyoqXHJcbiAgICogRGlzdGFuY2UsIGluIHBpeGVscywgdGhlIG1vZGFsIHNob3VsZCBwdXNoIGRvd24gZnJvbSB0aGUgdG9wIG9mIHRoZSBzY3JlZW4uXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGF1dG9cclxuICAgKi9cclxuICB2T2Zmc2V0OiAnYXV0bycsXHJcbiAgLyoqXHJcbiAgICogRGlzdGFuY2UsIGluIHBpeGVscywgdGhlIG1vZGFsIHNob3VsZCBwdXNoIGluIGZyb20gdGhlIHNpZGUgb2YgdGhlIHNjcmVlbi5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgYXV0b1xyXG4gICAqL1xyXG4gIGhPZmZzZXQ6ICdhdXRvJyxcclxuICAvKipcclxuICAgKiBBbGxvd3MgdGhlIG1vZGFsIHRvIGJlIGZ1bGxzY3JlZW4sIGNvbXBsZXRlbHkgYmxvY2tpbmcgb3V0IHRoZSByZXN0IG9mIHRoZSB2aWV3LiBKUyBjaGVja3MgZm9yIHRoaXMgYXMgd2VsbC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBmdWxsU2NyZWVuOiBmYWxzZSxcclxuICAvKipcclxuICAgKiBQZXJjZW50YWdlIG9mIHNjcmVlbiBoZWlnaHQgdGhlIG1vZGFsIHNob3VsZCBwdXNoIHVwIGZyb20gdGhlIGJvdHRvbSBvZiB0aGUgdmlldy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgMTBcclxuICAgKi9cclxuICBidG1PZmZzZXRQY3Q6IDEwLFxyXG4gIC8qKlxyXG4gICAqIEFsbG93cyB0aGUgbW9kYWwgdG8gZ2VuZXJhdGUgYW4gb3ZlcmxheSBkaXYsIHdoaWNoIHdpbGwgY292ZXIgdGhlIHZpZXcgd2hlbiBtb2RhbCBvcGVucy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgdHJ1ZVxyXG4gICAqL1xyXG4gIG92ZXJsYXk6IHRydWUsXHJcbiAgLyoqXHJcbiAgICogQWxsb3dzIHRoZSBtb2RhbCB0byByZW1vdmUgYW5kIHJlaW5qZWN0IG1hcmt1cCBvbiBjbG9zZS4gU2hvdWxkIGJlIHRydWUgaWYgdXNpbmcgdmlkZW8gZWxlbWVudHMgdy9vIHVzaW5nIHByb3ZpZGVyJ3MgYXBpLCBvdGhlcndpc2UsIHZpZGVvcyB3aWxsIGNvbnRpbnVlIHRvIHBsYXkgaW4gdGhlIGJhY2tncm91bmQuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgcmVzZXRPbkNsb3NlOiBmYWxzZSxcclxuICAvKipcclxuICAgKiBBbGxvd3MgdGhlIG1vZGFsIHRvIGFsdGVyIHRoZSB1cmwgb24gb3Blbi9jbG9zZSwgYW5kIGFsbG93cyB0aGUgdXNlIG9mIHRoZSBgYmFja2AgYnV0dG9uIHRvIGNsb3NlIG1vZGFscy4gQUxTTywgYWxsb3dzIGEgbW9kYWwgdG8gYXV0by1tYW5pYWNhbGx5IG9wZW4gb24gcGFnZSBsb2FkIElGIHRoZSBoYXNoID09PSB0aGUgbW9kYWwncyB1c2VyLXNldCBpZC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBkZWVwTGluazogZmFsc2UsXHJcbiAgICAvKipcclxuICAgKiBBbGxvd3MgdGhlIG1vZGFsIHRvIGFwcGVuZCB0byBjdXN0b20gZGl2LlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIGFwcGVuZFRvOiBcImJvZHlcIlxyXG5cclxufTtcclxuXHJcbi8vIFdpbmRvdyBleHBvcnRzXHJcbkZvdW5kYXRpb24ucGx1Z2luKFJldmVhbCwgJ1JldmVhbCcpO1xyXG5cclxuZnVuY3Rpb24gaVBob25lU25pZmYoKSB7XHJcbiAgcmV0dXJuIC9pUChhZHxob25lfG9kKS4qT1MvLnRlc3Qod2luZG93Lm5hdmlnYXRvci51c2VyQWdlbnQpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBhbmRyb2lkU25pZmYoKSB7XHJcbiAgcmV0dXJuIC9BbmRyb2lkLy50ZXN0KHdpbmRvdy5uYXZpZ2F0b3IudXNlckFnZW50KTtcclxufVxyXG5cclxuZnVuY3Rpb24gbW9iaWxlU25pZmYoKSB7XHJcbiAgcmV0dXJuIGlQaG9uZVNuaWZmKCkgfHwgYW5kcm9pZFNuaWZmKCk7XHJcbn1cclxuXHJcbn0oalF1ZXJ5KTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuIWZ1bmN0aW9uKCQpIHtcclxuXHJcbi8qKlxyXG4gKiBTbGlkZXIgbW9kdWxlLlxyXG4gKiBAbW9kdWxlIGZvdW5kYXRpb24uc2xpZGVyXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwubW90aW9uXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwudHJpZ2dlcnNcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC5rZXlib2FyZFxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLnRvdWNoXHJcbiAqL1xyXG5cclxuY2xhc3MgU2xpZGVyIHtcclxuICAvKipcclxuICAgKiBDcmVhdGVzIGEgbmV3IGluc3RhbmNlIG9mIGEgc2xpZGVyIGNvbnRyb2wuXHJcbiAgICogQGNsYXNzXHJcbiAgICogQHBhcmFtIHtqUXVlcnl9IGVsZW1lbnQgLSBqUXVlcnkgb2JqZWN0IHRvIG1ha2UgaW50byBhIHNsaWRlciBjb250cm9sLlxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIC0gT3ZlcnJpZGVzIHRvIHRoZSBkZWZhdWx0IHBsdWdpbiBzZXR0aW5ncy5cclxuICAgKi9cclxuICBjb25zdHJ1Y3RvcihlbGVtZW50LCBvcHRpb25zKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50ID0gZWxlbWVudDtcclxuICAgIHRoaXMub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBTbGlkZXIuZGVmYXVsdHMsIHRoaXMuJGVsZW1lbnQuZGF0YSgpLCBvcHRpb25zKTtcclxuXHJcbiAgICB0aGlzLl9pbml0KCk7XHJcblxyXG4gICAgRm91bmRhdGlvbi5yZWdpc3RlclBsdWdpbih0aGlzLCAnU2xpZGVyJyk7XHJcbiAgICBGb3VuZGF0aW9uLktleWJvYXJkLnJlZ2lzdGVyKCdTbGlkZXInLCB7XHJcbiAgICAgICdsdHInOiB7XHJcbiAgICAgICAgJ0FSUk9XX1JJR0hUJzogJ2luY3JlYXNlJyxcclxuICAgICAgICAnQVJST1dfVVAnOiAnaW5jcmVhc2UnLFxyXG4gICAgICAgICdBUlJPV19ET1dOJzogJ2RlY3JlYXNlJyxcclxuICAgICAgICAnQVJST1dfTEVGVCc6ICdkZWNyZWFzZScsXHJcbiAgICAgICAgJ1NISUZUX0FSUk9XX1JJR0hUJzogJ2luY3JlYXNlX2Zhc3QnLFxyXG4gICAgICAgICdTSElGVF9BUlJPV19VUCc6ICdpbmNyZWFzZV9mYXN0JyxcclxuICAgICAgICAnU0hJRlRfQVJST1dfRE9XTic6ICdkZWNyZWFzZV9mYXN0JyxcclxuICAgICAgICAnU0hJRlRfQVJST1dfTEVGVCc6ICdkZWNyZWFzZV9mYXN0J1xyXG4gICAgICB9LFxyXG4gICAgICAncnRsJzoge1xyXG4gICAgICAgICdBUlJPV19MRUZUJzogJ2luY3JlYXNlJyxcclxuICAgICAgICAnQVJST1dfUklHSFQnOiAnZGVjcmVhc2UnLFxyXG4gICAgICAgICdTSElGVF9BUlJPV19MRUZUJzogJ2luY3JlYXNlX2Zhc3QnLFxyXG4gICAgICAgICdTSElGVF9BUlJPV19SSUdIVCc6ICdkZWNyZWFzZV9mYXN0J1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEluaXRpbGl6ZXMgdGhlIHBsdWdpbiBieSByZWFkaW5nL3NldHRpbmcgYXR0cmlidXRlcywgY3JlYXRpbmcgY29sbGVjdGlvbnMgYW5kIHNldHRpbmcgdGhlIGluaXRpYWwgcG9zaXRpb24gb2YgdGhlIGhhbmRsZShzKS5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9pbml0KCkge1xyXG4gICAgdGhpcy5pbnB1dHMgPSB0aGlzLiRlbGVtZW50LmZpbmQoJ2lucHV0Jyk7XHJcbiAgICB0aGlzLmhhbmRsZXMgPSB0aGlzLiRlbGVtZW50LmZpbmQoJ1tkYXRhLXNsaWRlci1oYW5kbGVdJyk7XHJcblxyXG4gICAgdGhpcy4kaGFuZGxlID0gdGhpcy5oYW5kbGVzLmVxKDApO1xyXG4gICAgdGhpcy4kaW5wdXQgPSB0aGlzLmlucHV0cy5sZW5ndGggPyB0aGlzLmlucHV0cy5lcSgwKSA6ICQoYCMke3RoaXMuJGhhbmRsZS5hdHRyKCdhcmlhLWNvbnRyb2xzJyl9YCk7XHJcbiAgICB0aGlzLiRmaWxsID0gdGhpcy4kZWxlbWVudC5maW5kKCdbZGF0YS1zbGlkZXItZmlsbF0nKS5jc3ModGhpcy5vcHRpb25zLnZlcnRpY2FsID8gJ2hlaWdodCcgOiAnd2lkdGgnLCAwKTtcclxuXHJcbiAgICB2YXIgaXNEYmwgPSBmYWxzZSxcclxuICAgICAgICBfdGhpcyA9IHRoaXM7XHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmRpc2FibGVkIHx8IHRoaXMuJGVsZW1lbnQuaGFzQ2xhc3ModGhpcy5vcHRpb25zLmRpc2FibGVkQ2xhc3MpKSB7XHJcbiAgICAgIHRoaXMub3B0aW9ucy5kaXNhYmxlZCA9IHRydWU7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQuYWRkQ2xhc3ModGhpcy5vcHRpb25zLmRpc2FibGVkQ2xhc3MpO1xyXG4gICAgfVxyXG4gICAgaWYgKCF0aGlzLmlucHV0cy5sZW5ndGgpIHtcclxuICAgICAgdGhpcy5pbnB1dHMgPSAkKCkuYWRkKHRoaXMuJGlucHV0KTtcclxuICAgICAgdGhpcy5vcHRpb25zLmJpbmRpbmcgPSB0cnVlO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuX3NldEluaXRBdHRyKDApO1xyXG5cclxuICAgIGlmICh0aGlzLmhhbmRsZXNbMV0pIHtcclxuICAgICAgdGhpcy5vcHRpb25zLmRvdWJsZVNpZGVkID0gdHJ1ZTtcclxuICAgICAgdGhpcy4kaGFuZGxlMiA9IHRoaXMuaGFuZGxlcy5lcSgxKTtcclxuICAgICAgdGhpcy4kaW5wdXQyID0gdGhpcy5pbnB1dHMubGVuZ3RoID4gMSA/IHRoaXMuaW5wdXRzLmVxKDEpIDogJChgIyR7dGhpcy4kaGFuZGxlMi5hdHRyKCdhcmlhLWNvbnRyb2xzJyl9YCk7XHJcblxyXG4gICAgICBpZiAoIXRoaXMuaW5wdXRzWzFdKSB7XHJcbiAgICAgICAgdGhpcy5pbnB1dHMgPSB0aGlzLmlucHV0cy5hZGQodGhpcy4kaW5wdXQyKTtcclxuICAgICAgfVxyXG4gICAgICBpc0RibCA9IHRydWU7XHJcblxyXG4gICAgICAvLyB0aGlzLiRoYW5kbGUudHJpZ2dlckhhbmRsZXIoJ2NsaWNrLnpmLnNsaWRlcicpO1xyXG4gICAgICB0aGlzLl9zZXRJbml0QXR0cigxKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBTZXQgaGFuZGxlIHBvc2l0aW9uc1xyXG4gICAgdGhpcy5zZXRIYW5kbGVzKCk7XHJcblxyXG4gICAgdGhpcy5fZXZlbnRzKCk7XHJcbiAgfVxyXG5cclxuICBzZXRIYW5kbGVzKCkge1xyXG4gICAgaWYodGhpcy5oYW5kbGVzWzFdKSB7XHJcbiAgICAgIHRoaXMuX3NldEhhbmRsZVBvcyh0aGlzLiRoYW5kbGUsIHRoaXMuaW5wdXRzLmVxKDApLnZhbCgpLCB0cnVlLCAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5fc2V0SGFuZGxlUG9zKHRoaXMuJGhhbmRsZTIsIHRoaXMuaW5wdXRzLmVxKDEpLnZhbCgpLCB0cnVlKTtcclxuICAgICAgfSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLl9zZXRIYW5kbGVQb3ModGhpcy4kaGFuZGxlLCB0aGlzLmlucHV0cy5lcSgwKS52YWwoKSwgdHJ1ZSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBfcmVmbG93KCkge1xyXG4gICAgdGhpcy5zZXRIYW5kbGVzKCk7XHJcbiAgfVxyXG4gIC8qKlxyXG4gICogQGZ1bmN0aW9uXHJcbiAgKiBAcHJpdmF0ZVxyXG4gICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlIC0gZmxvYXRpbmcgcG9pbnQgKHRoZSB2YWx1ZSkgdG8gYmUgdHJhbnNmb3JtZWQgdXNpbmcgdG8gYSByZWxhdGl2ZSBwb3NpdGlvbiBvbiB0aGUgc2xpZGVyICh0aGUgaW52ZXJzZSBvZiBfdmFsdWUpXHJcbiAgKi9cclxuICBfcGN0T2ZCYXIodmFsdWUpIHtcclxuICAgIHZhciBwY3RPZkJhciA9IHBlcmNlbnQodmFsdWUgLSB0aGlzLm9wdGlvbnMuc3RhcnQsIHRoaXMub3B0aW9ucy5lbmQgLSB0aGlzLm9wdGlvbnMuc3RhcnQpXHJcblxyXG4gICAgc3dpdGNoKHRoaXMub3B0aW9ucy5wb3NpdGlvblZhbHVlRnVuY3Rpb24pIHtcclxuICAgIGNhc2UgXCJwb3dcIjpcclxuICAgICAgcGN0T2ZCYXIgPSB0aGlzLl9sb2dUcmFuc2Zvcm0ocGN0T2ZCYXIpO1xyXG4gICAgICBicmVhaztcclxuICAgIGNhc2UgXCJsb2dcIjpcclxuICAgICAgcGN0T2ZCYXIgPSB0aGlzLl9wb3dUcmFuc2Zvcm0ocGN0T2ZCYXIpO1xyXG4gICAgICBicmVhaztcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gcGN0T2ZCYXIudG9GaXhlZCgyKVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgKiBAZnVuY3Rpb25cclxuICAqIEBwcml2YXRlXHJcbiAgKiBAcGFyYW0ge051bWJlcn0gcGN0T2ZCYXIgLSBmbG9hdGluZyBwb2ludCwgdGhlIHJlbGF0aXZlIHBvc2l0aW9uIG9mIHRoZSBzbGlkZXIgKHR5cGljYWxseSBiZXR3ZWVuIDAtMSkgdG8gYmUgdHJhbnNmb3JtZWQgdG8gYSB2YWx1ZVxyXG4gICovXHJcbiAgX3ZhbHVlKHBjdE9mQmFyKSB7XHJcbiAgICBzd2l0Y2godGhpcy5vcHRpb25zLnBvc2l0aW9uVmFsdWVGdW5jdGlvbikge1xyXG4gICAgY2FzZSBcInBvd1wiOlxyXG4gICAgICBwY3RPZkJhciA9IHRoaXMuX3Bvd1RyYW5zZm9ybShwY3RPZkJhcik7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSBcImxvZ1wiOlxyXG4gICAgICBwY3RPZkJhciA9IHRoaXMuX2xvZ1RyYW5zZm9ybShwY3RPZkJhcik7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG4gICAgdmFyIHZhbHVlID0gKHRoaXMub3B0aW9ucy5lbmQgLSB0aGlzLm9wdGlvbnMuc3RhcnQpICogcGN0T2ZCYXIgKyB0aGlzLm9wdGlvbnMuc3RhcnQ7XHJcblxyXG4gICAgcmV0dXJuIHZhbHVlXHJcbiAgfVxyXG5cclxuICAvKipcclxuICAqIEBmdW5jdGlvblxyXG4gICogQHByaXZhdGVcclxuICAqIEBwYXJhbSB7TnVtYmVyfSB2YWx1ZSAtIGZsb2F0aW5nIHBvaW50ICh0eXBpY2FsbHkgYmV0d2VlbiAwLTEpIHRvIGJlIHRyYW5zZm9ybWVkIHVzaW5nIHRoZSBsb2cgZnVuY3Rpb25cclxuICAqL1xyXG4gIF9sb2dUcmFuc2Zvcm0odmFsdWUpIHtcclxuICAgIHJldHVybiBiYXNlTG9nKHRoaXMub3B0aW9ucy5ub25MaW5lYXJCYXNlLCAoKHZhbHVlKih0aGlzLm9wdGlvbnMubm9uTGluZWFyQmFzZS0xKSkrMSkpXHJcbiAgfVxyXG5cclxuICAvKipcclxuICAqIEBmdW5jdGlvblxyXG4gICogQHByaXZhdGVcclxuICAqIEBwYXJhbSB7TnVtYmVyfSB2YWx1ZSAtIGZsb2F0aW5nIHBvaW50ICh0eXBpY2FsbHkgYmV0d2VlbiAwLTEpIHRvIGJlIHRyYW5zZm9ybWVkIHVzaW5nIHRoZSBwb3dlciBmdW5jdGlvblxyXG4gICovXHJcbiAgX3Bvd1RyYW5zZm9ybSh2YWx1ZSkge1xyXG4gICAgcmV0dXJuIChNYXRoLnBvdyh0aGlzLm9wdGlvbnMubm9uTGluZWFyQmFzZSwgdmFsdWUpIC0gMSkgLyAodGhpcy5vcHRpb25zLm5vbkxpbmVhckJhc2UgLSAxKVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0cyB0aGUgcG9zaXRpb24gb2YgdGhlIHNlbGVjdGVkIGhhbmRsZSBhbmQgZmlsbCBiYXIuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gJGhuZGwgLSB0aGUgc2VsZWN0ZWQgaGFuZGxlIHRvIG1vdmUuXHJcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGxvY2F0aW9uIC0gZmxvYXRpbmcgcG9pbnQgYmV0d2VlbiB0aGUgc3RhcnQgYW5kIGVuZCB2YWx1ZXMgb2YgdGhlIHNsaWRlciBiYXIuXHJcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2IgLSBjYWxsYmFjayBmdW5jdGlvbiB0byBmaXJlIG9uIGNvbXBsZXRpb24uXHJcbiAgICogQGZpcmVzIFNsaWRlciNtb3ZlZFxyXG4gICAqIEBmaXJlcyBTbGlkZXIjY2hhbmdlZFxyXG4gICAqL1xyXG4gIF9zZXRIYW5kbGVQb3MoJGhuZGwsIGxvY2F0aW9uLCBub0ludmVydCwgY2IpIHtcclxuICAgIC8vIGRvbid0IG1vdmUgaWYgdGhlIHNsaWRlciBoYXMgYmVlbiBkaXNhYmxlZCBzaW5jZSBpdHMgaW5pdGlhbGl6YXRpb25cclxuICAgIGlmICh0aGlzLiRlbGVtZW50Lmhhc0NsYXNzKHRoaXMub3B0aW9ucy5kaXNhYmxlZENsYXNzKSkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICAvL21pZ2h0IG5lZWQgdG8gYWx0ZXIgdGhhdCBzbGlnaHRseSBmb3IgYmFycyB0aGF0IHdpbGwgaGF2ZSBvZGQgbnVtYmVyIHNlbGVjdGlvbnMuXHJcbiAgICBsb2NhdGlvbiA9IHBhcnNlRmxvYXQobG9jYXRpb24pOy8vb24gaW5wdXQgY2hhbmdlIGV2ZW50cywgY29udmVydCBzdHJpbmcgdG8gbnVtYmVyLi4uZ3J1bWJsZS5cclxuXHJcbiAgICAvLyBwcmV2ZW50IHNsaWRlciBmcm9tIHJ1bm5pbmcgb3V0IG9mIGJvdW5kcywgaWYgdmFsdWUgZXhjZWVkcyB0aGUgbGltaXRzIHNldCB0aHJvdWdoIG9wdGlvbnMsIG92ZXJyaWRlIHRoZSB2YWx1ZSB0byBtaW4vbWF4XHJcbiAgICBpZiAobG9jYXRpb24gPCB0aGlzLm9wdGlvbnMuc3RhcnQpIHsgbG9jYXRpb24gPSB0aGlzLm9wdGlvbnMuc3RhcnQ7IH1cclxuICAgIGVsc2UgaWYgKGxvY2F0aW9uID4gdGhpcy5vcHRpb25zLmVuZCkgeyBsb2NhdGlvbiA9IHRoaXMub3B0aW9ucy5lbmQ7IH1cclxuXHJcbiAgICB2YXIgaXNEYmwgPSB0aGlzLm9wdGlvbnMuZG91YmxlU2lkZWQ7XHJcblxyXG4gICAgaWYgKGlzRGJsKSB7IC8vdGhpcyBibG9jayBpcyB0byBwcmV2ZW50IDIgaGFuZGxlcyBmcm9tIGNyb3NzaW5nIGVhY2hvdGhlci4gQ291bGQvc2hvdWxkIGJlIGltcHJvdmVkLlxyXG4gICAgICBpZiAodGhpcy5oYW5kbGVzLmluZGV4KCRobmRsKSA9PT0gMCkge1xyXG4gICAgICAgIHZhciBoMlZhbCA9IHBhcnNlRmxvYXQodGhpcy4kaGFuZGxlMi5hdHRyKCdhcmlhLXZhbHVlbm93JykpO1xyXG4gICAgICAgIGxvY2F0aW9uID0gbG9jYXRpb24gPj0gaDJWYWwgPyBoMlZhbCAtIHRoaXMub3B0aW9ucy5zdGVwIDogbG9jYXRpb247XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdmFyIGgxVmFsID0gcGFyc2VGbG9hdCh0aGlzLiRoYW5kbGUuYXR0cignYXJpYS12YWx1ZW5vdycpKTtcclxuICAgICAgICBsb2NhdGlvbiA9IGxvY2F0aW9uIDw9IGgxVmFsID8gaDFWYWwgKyB0aGlzLm9wdGlvbnMuc3RlcCA6IGxvY2F0aW9uO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy90aGlzIGlzIGZvciBzaW5nbGUtaGFuZGxlZCB2ZXJ0aWNhbCBzbGlkZXJzLCBpdCBhZGp1c3RzIHRoZSB2YWx1ZSB0byBhY2NvdW50IGZvciB0aGUgc2xpZGVyIGJlaW5nIFwidXBzaWRlLWRvd25cIlxyXG4gICAgLy9mb3IgY2xpY2sgYW5kIGRyYWcgZXZlbnRzLCBpdCdzIHdlaXJkIGR1ZSB0byB0aGUgc2NhbGUoLTEsIDEpIGNzcyBwcm9wZXJ0eVxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy52ZXJ0aWNhbCAmJiAhbm9JbnZlcnQpIHtcclxuICAgICAgbG9jYXRpb24gPSB0aGlzLm9wdGlvbnMuZW5kIC0gbG9jYXRpb247XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIF90aGlzID0gdGhpcyxcclxuICAgICAgICB2ZXJ0ID0gdGhpcy5vcHRpb25zLnZlcnRpY2FsLFxyXG4gICAgICAgIGhPclcgPSB2ZXJ0ID8gJ2hlaWdodCcgOiAnd2lkdGgnLFxyXG4gICAgICAgIGxPclQgPSB2ZXJ0ID8gJ3RvcCcgOiAnbGVmdCcsXHJcbiAgICAgICAgaGFuZGxlRGltID0gJGhuZGxbMF0uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KClbaE9yV10sXHJcbiAgICAgICAgZWxlbURpbSA9IHRoaXMuJGVsZW1lbnRbMF0uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KClbaE9yV10sXHJcbiAgICAgICAgLy9wZXJjZW50YWdlIG9mIGJhciBtaW4vbWF4IHZhbHVlIGJhc2VkIG9uIGNsaWNrIG9yIGRyYWcgcG9pbnRcclxuICAgICAgICBwY3RPZkJhciA9IHRoaXMuX3BjdE9mQmFyKGxvY2F0aW9uKSxcclxuICAgICAgICAvL251bWJlciBvZiBhY3R1YWwgcGl4ZWxzIHRvIHNoaWZ0IHRoZSBoYW5kbGUsIGJhc2VkIG9uIHRoZSBwZXJjZW50YWdlIG9idGFpbmVkIGFib3ZlXHJcbiAgICAgICAgcHhUb01vdmUgPSAoZWxlbURpbSAtIGhhbmRsZURpbSkgKiBwY3RPZkJhcixcclxuICAgICAgICAvL3BlcmNlbnRhZ2Ugb2YgYmFyIHRvIHNoaWZ0IHRoZSBoYW5kbGVcclxuICAgICAgICBtb3ZlbWVudCA9IChwZXJjZW50KHB4VG9Nb3ZlLCBlbGVtRGltKSAqIDEwMCkudG9GaXhlZCh0aGlzLm9wdGlvbnMuZGVjaW1hbCk7XHJcbiAgICAgICAgLy9maXhpbmcgdGhlIGRlY2ltYWwgdmFsdWUgZm9yIHRoZSBsb2NhdGlvbiBudW1iZXIsIGlzIHBhc3NlZCB0byBvdGhlciBtZXRob2RzIGFzIGEgZml4ZWQgZmxvYXRpbmctcG9pbnQgdmFsdWVcclxuICAgICAgICBsb2NhdGlvbiA9IHBhcnNlRmxvYXQobG9jYXRpb24udG9GaXhlZCh0aGlzLm9wdGlvbnMuZGVjaW1hbCkpO1xyXG4gICAgICAgIC8vIGRlY2xhcmUgZW1wdHkgb2JqZWN0IGZvciBjc3MgYWRqdXN0bWVudHMsIG9ubHkgdXNlZCB3aXRoIDIgaGFuZGxlZC1zbGlkZXJzXHJcbiAgICB2YXIgY3NzID0ge307XHJcblxyXG4gICAgdGhpcy5fc2V0VmFsdWVzKCRobmRsLCBsb2NhdGlvbik7XHJcblxyXG4gICAgLy8gVE9ETyB1cGRhdGUgdG8gY2FsY3VsYXRlIGJhc2VkIG9uIHZhbHVlcyBzZXQgdG8gcmVzcGVjdGl2ZSBpbnB1dHM/P1xyXG4gICAgaWYgKGlzRGJsKSB7XHJcbiAgICAgIHZhciBpc0xlZnRIbmRsID0gdGhpcy5oYW5kbGVzLmluZGV4KCRobmRsKSA9PT0gMCxcclxuICAgICAgICAgIC8vZW1wdHkgdmFyaWFibGUsIHdpbGwgYmUgdXNlZCBmb3IgbWluLWhlaWdodC93aWR0aCBmb3IgZmlsbCBiYXJcclxuICAgICAgICAgIGRpbSxcclxuICAgICAgICAgIC8vcGVyY2VudGFnZSB3L2ggb2YgdGhlIGhhbmRsZSBjb21wYXJlZCB0byB0aGUgc2xpZGVyIGJhclxyXG4gICAgICAgICAgaGFuZGxlUGN0ID0gIH5+KHBlcmNlbnQoaGFuZGxlRGltLCBlbGVtRGltKSAqIDEwMCk7XHJcbiAgICAgIC8vaWYgbGVmdCBoYW5kbGUsIHRoZSBtYXRoIGlzIHNsaWdodGx5IGRpZmZlcmVudCB0aGFuIGlmIGl0J3MgdGhlIHJpZ2h0IGhhbmRsZSwgYW5kIHRoZSBsZWZ0L3RvcCBwcm9wZXJ0eSBuZWVkcyB0byBiZSBjaGFuZ2VkIGZvciB0aGUgZmlsbCBiYXJcclxuICAgICAgaWYgKGlzTGVmdEhuZGwpIHtcclxuICAgICAgICAvL2xlZnQgb3IgdG9wIHBlcmNlbnRhZ2UgdmFsdWUgdG8gYXBwbHkgdG8gdGhlIGZpbGwgYmFyLlxyXG4gICAgICAgIGNzc1tsT3JUXSA9IGAke21vdmVtZW50fSVgO1xyXG4gICAgICAgIC8vY2FsY3VsYXRlIHRoZSBuZXcgbWluLWhlaWdodC93aWR0aCBmb3IgdGhlIGZpbGwgYmFyLlxyXG4gICAgICAgIGRpbSA9IHBhcnNlRmxvYXQodGhpcy4kaGFuZGxlMlswXS5zdHlsZVtsT3JUXSkgLSBtb3ZlbWVudCArIGhhbmRsZVBjdDtcclxuICAgICAgICAvL3RoaXMgY2FsbGJhY2sgaXMgbmVjZXNzYXJ5IHRvIHByZXZlbnQgZXJyb3JzIGFuZCBhbGxvdyB0aGUgcHJvcGVyIHBsYWNlbWVudCBhbmQgaW5pdGlhbGl6YXRpb24gb2YgYSAyLWhhbmRsZWQgc2xpZGVyXHJcbiAgICAgICAgLy9wbHVzLCBpdCBtZWFucyB3ZSBkb24ndCBjYXJlIGlmICdkaW0nIGlzTmFOIG9uIGluaXQsIGl0IHdvbid0IGJlIGluIHRoZSBmdXR1cmUuXHJcbiAgICAgICAgaWYgKGNiICYmIHR5cGVvZiBjYiA9PT0gJ2Z1bmN0aW9uJykgeyBjYigpOyB9Ly90aGlzIGlzIG9ubHkgbmVlZGVkIGZvciB0aGUgaW5pdGlhbGl6YXRpb24gb2YgMiBoYW5kbGVkIHNsaWRlcnNcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvL2p1c3QgY2FjaGluZyB0aGUgdmFsdWUgb2YgdGhlIGxlZnQvYm90dG9tIGhhbmRsZSdzIGxlZnQvdG9wIHByb3BlcnR5XHJcbiAgICAgICAgdmFyIGhhbmRsZVBvcyA9IHBhcnNlRmxvYXQodGhpcy4kaGFuZGxlWzBdLnN0eWxlW2xPclRdKTtcclxuICAgICAgICAvL2NhbGN1bGF0ZSB0aGUgbmV3IG1pbi1oZWlnaHQvd2lkdGggZm9yIHRoZSBmaWxsIGJhci4gVXNlIGlzTmFOIHRvIHByZXZlbnQgZmFsc2UgcG9zaXRpdmVzIGZvciBudW1iZXJzIDw9IDBcclxuICAgICAgICAvL2Jhc2VkIG9uIHRoZSBwZXJjZW50YWdlIG9mIG1vdmVtZW50IG9mIHRoZSBoYW5kbGUgYmVpbmcgbWFuaXB1bGF0ZWQsIGxlc3MgdGhlIG9wcG9zaW5nIGhhbmRsZSdzIGxlZnQvdG9wIHBvc2l0aW9uLCBwbHVzIHRoZSBwZXJjZW50YWdlIHcvaCBvZiB0aGUgaGFuZGxlIGl0c2VsZlxyXG4gICAgICAgIGRpbSA9IG1vdmVtZW50IC0gKGlzTmFOKGhhbmRsZVBvcykgPyAodGhpcy5vcHRpb25zLmluaXRpYWxTdGFydCAtIHRoaXMub3B0aW9ucy5zdGFydCkvKCh0aGlzLm9wdGlvbnMuZW5kLXRoaXMub3B0aW9ucy5zdGFydCkvMTAwKSA6IGhhbmRsZVBvcykgKyBoYW5kbGVQY3Q7XHJcbiAgICAgIH1cclxuICAgICAgLy8gYXNzaWduIHRoZSBtaW4taGVpZ2h0L3dpZHRoIHRvIG91ciBjc3Mgb2JqZWN0XHJcbiAgICAgIGNzc1tgbWluLSR7aE9yV31gXSA9IGAke2RpbX0lYDtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLiRlbGVtZW50Lm9uZSgnZmluaXNoZWQuemYuYW5pbWF0ZScsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAgICAgICAgICAqIEZpcmVzIHdoZW4gdGhlIGhhbmRsZSBpcyBkb25lIG1vdmluZy5cclxuICAgICAgICAgICAgICAgICAgICAgKiBAZXZlbnQgU2xpZGVyI21vdmVkXHJcbiAgICAgICAgICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMuJGVsZW1lbnQudHJpZ2dlcignbW92ZWQuemYuc2xpZGVyJywgWyRobmRsXSk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAvL2JlY2F1c2Ugd2UgZG9uJ3Qga25vdyBleGFjdGx5IGhvdyB0aGUgaGFuZGxlIHdpbGwgYmUgbW92ZWQsIGNoZWNrIHRoZSBhbW91bnQgb2YgdGltZSBpdCBzaG91bGQgdGFrZSB0byBtb3ZlLlxyXG4gICAgdmFyIG1vdmVUaW1lID0gdGhpcy4kZWxlbWVudC5kYXRhKCdkcmFnZ2luZycpID8gMTAwMC82MCA6IHRoaXMub3B0aW9ucy5tb3ZlVGltZTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLk1vdmUobW92ZVRpbWUsICRobmRsLCBmdW5jdGlvbigpIHtcclxuICAgICAgLy8gYWRqdXN0aW5nIHRoZSBsZWZ0L3RvcCBwcm9wZXJ0eSBvZiB0aGUgaGFuZGxlLCBiYXNlZCBvbiB0aGUgcGVyY2VudGFnZSBjYWxjdWxhdGVkIGFib3ZlXHJcbiAgICAgIC8vIGlmIG1vdmVtZW50IGlzTmFOLCB0aGF0IGlzIGJlY2F1c2UgdGhlIHNsaWRlciBpcyBoaWRkZW4gYW5kIHdlIGNhbm5vdCBkZXRlcm1pbmUgaGFuZGxlIHdpZHRoLFxyXG4gICAgICAvLyBmYWxsIGJhY2sgdG8gbmV4dCBiZXN0IGd1ZXNzLlxyXG4gICAgICBpZiAoaXNOYU4obW92ZW1lbnQpKSB7XHJcbiAgICAgICAgJGhuZGwuY3NzKGxPclQsIGAke3BjdE9mQmFyICogMTAwfSVgKTtcclxuICAgICAgfVxyXG4gICAgICBlbHNlIHtcclxuICAgICAgICAkaG5kbC5jc3MobE9yVCwgYCR7bW92ZW1lbnR9JWApO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoIV90aGlzLm9wdGlvbnMuZG91YmxlU2lkZWQpIHtcclxuICAgICAgICAvL2lmIHNpbmdsZS1oYW5kbGVkLCBhIHNpbXBsZSBtZXRob2QgdG8gZXhwYW5kIHRoZSBmaWxsIGJhclxyXG4gICAgICAgIF90aGlzLiRmaWxsLmNzcyhoT3JXLCBgJHtwY3RPZkJhciAqIDEwMH0lYCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy9vdGhlcndpc2UsIHVzZSB0aGUgY3NzIG9iamVjdCB3ZSBjcmVhdGVkIGFib3ZlXHJcbiAgICAgICAgX3RoaXMuJGZpbGwuY3NzKGNzcyk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuXHJcbiAgICAvKipcclxuICAgICAqIEZpcmVzIHdoZW4gdGhlIHZhbHVlIGhhcyBub3QgYmVlbiBjaGFuZ2UgZm9yIGEgZ2l2ZW4gdGltZS5cclxuICAgICAqIEBldmVudCBTbGlkZXIjY2hhbmdlZFxyXG4gICAgICovXHJcbiAgICBjbGVhclRpbWVvdXQoX3RoaXMudGltZW91dCk7XHJcbiAgICBfdGhpcy50aW1lb3V0ID0gc2V0VGltZW91dChmdW5jdGlvbigpe1xyXG4gICAgICBfdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdjaGFuZ2VkLnpmLnNsaWRlcicsIFskaG5kbF0pO1xyXG4gICAgfSwgX3RoaXMub3B0aW9ucy5jaGFuZ2VkRGVsYXkpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0cyB0aGUgaW5pdGlhbCBhdHRyaWJ1dGUgZm9yIHRoZSBzbGlkZXIgZWxlbWVudC5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBpZHggLSBpbmRleCBvZiB0aGUgY3VycmVudCBoYW5kbGUvaW5wdXQgdG8gdXNlLlxyXG4gICAqL1xyXG4gIF9zZXRJbml0QXR0cihpZHgpIHtcclxuICAgIHZhciBpbml0VmFsID0gKGlkeCA9PT0gMCA/IHRoaXMub3B0aW9ucy5pbml0aWFsU3RhcnQgOiB0aGlzLm9wdGlvbnMuaW5pdGlhbEVuZClcclxuICAgIHZhciBpZCA9IHRoaXMuaW5wdXRzLmVxKGlkeCkuYXR0cignaWQnKSB8fCBGb3VuZGF0aW9uLkdldFlvRGlnaXRzKDYsICdzbGlkZXInKTtcclxuICAgIHRoaXMuaW5wdXRzLmVxKGlkeCkuYXR0cih7XHJcbiAgICAgICdpZCc6IGlkLFxyXG4gICAgICAnbWF4JzogdGhpcy5vcHRpb25zLmVuZCxcclxuICAgICAgJ21pbic6IHRoaXMub3B0aW9ucy5zdGFydCxcclxuICAgICAgJ3N0ZXAnOiB0aGlzLm9wdGlvbnMuc3RlcFxyXG4gICAgfSk7XHJcbiAgICB0aGlzLmlucHV0cy5lcShpZHgpLnZhbChpbml0VmFsKTtcclxuICAgIHRoaXMuaGFuZGxlcy5lcShpZHgpLmF0dHIoe1xyXG4gICAgICAncm9sZSc6ICdzbGlkZXInLFxyXG4gICAgICAnYXJpYS1jb250cm9scyc6IGlkLFxyXG4gICAgICAnYXJpYS12YWx1ZW1heCc6IHRoaXMub3B0aW9ucy5lbmQsXHJcbiAgICAgICdhcmlhLXZhbHVlbWluJzogdGhpcy5vcHRpb25zLnN0YXJ0LFxyXG4gICAgICAnYXJpYS12YWx1ZW5vdyc6IGluaXRWYWwsXHJcbiAgICAgICdhcmlhLW9yaWVudGF0aW9uJzogdGhpcy5vcHRpb25zLnZlcnRpY2FsID8gJ3ZlcnRpY2FsJyA6ICdob3Jpem9udGFsJyxcclxuICAgICAgJ3RhYmluZGV4JzogMFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZXRzIHRoZSBpbnB1dCBhbmQgYGFyaWEtdmFsdWVub3dgIHZhbHVlcyBmb3IgdGhlIHNsaWRlciBlbGVtZW50LlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICogQHBhcmFtIHtqUXVlcnl9ICRoYW5kbGUgLSB0aGUgY3VycmVudGx5IHNlbGVjdGVkIGhhbmRsZS5cclxuICAgKiBAcGFyYW0ge051bWJlcn0gdmFsIC0gZmxvYXRpbmcgcG9pbnQgb2YgdGhlIG5ldyB2YWx1ZS5cclxuICAgKi9cclxuICBfc2V0VmFsdWVzKCRoYW5kbGUsIHZhbCkge1xyXG4gICAgdmFyIGlkeCA9IHRoaXMub3B0aW9ucy5kb3VibGVTaWRlZCA/IHRoaXMuaGFuZGxlcy5pbmRleCgkaGFuZGxlKSA6IDA7XHJcbiAgICB0aGlzLmlucHV0cy5lcShpZHgpLnZhbCh2YWwpO1xyXG4gICAgJGhhbmRsZS5hdHRyKCdhcmlhLXZhbHVlbm93JywgdmFsKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZXMgZXZlbnRzIG9uIHRoZSBzbGlkZXIgZWxlbWVudC5cclxuICAgKiBDYWxjdWxhdGVzIHRoZSBuZXcgbG9jYXRpb24gb2YgdGhlIGN1cnJlbnQgaGFuZGxlLlxyXG4gICAqIElmIHRoZXJlIGFyZSB0d28gaGFuZGxlcyBhbmQgdGhlIGJhciB3YXMgY2xpY2tlZCwgaXQgZGV0ZXJtaW5lcyB3aGljaCBoYW5kbGUgdG8gbW92ZS5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBlIC0gdGhlIGBldmVudGAgb2JqZWN0IHBhc3NlZCBmcm9tIHRoZSBsaXN0ZW5lci5cclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gJGhhbmRsZSAtIHRoZSBjdXJyZW50IGhhbmRsZSB0byBjYWxjdWxhdGUgZm9yLCBpZiBzZWxlY3RlZC5cclxuICAgKiBAcGFyYW0ge051bWJlcn0gdmFsIC0gZmxvYXRpbmcgcG9pbnQgbnVtYmVyIGZvciB0aGUgbmV3IHZhbHVlIG9mIHRoZSBzbGlkZXIuXHJcbiAgICogVE9ETyBjbGVhbiB0aGlzIHVwLCB0aGVyZSdzIGEgbG90IG9mIHJlcGVhdGVkIGNvZGUgYmV0d2VlbiB0aGlzIGFuZCB0aGUgX3NldEhhbmRsZVBvcyBmbi5cclxuICAgKi9cclxuICBfaGFuZGxlRXZlbnQoZSwgJGhhbmRsZSwgdmFsKSB7XHJcbiAgICB2YXIgdmFsdWUsIGhhc1ZhbDtcclxuICAgIGlmICghdmFsKSB7Ly9jbGljayBvciBkcmFnIGV2ZW50c1xyXG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgIHZhciBfdGhpcyA9IHRoaXMsXHJcbiAgICAgICAgICB2ZXJ0aWNhbCA9IHRoaXMub3B0aW9ucy52ZXJ0aWNhbCxcclxuICAgICAgICAgIHBhcmFtID0gdmVydGljYWwgPyAnaGVpZ2h0JyA6ICd3aWR0aCcsXHJcbiAgICAgICAgICBkaXJlY3Rpb24gPSB2ZXJ0aWNhbCA/ICd0b3AnIDogJ2xlZnQnLFxyXG4gICAgICAgICAgZXZlbnRPZmZzZXQgPSB2ZXJ0aWNhbCA/IGUucGFnZVkgOiBlLnBhZ2VYLFxyXG4gICAgICAgICAgaGFsZk9mSGFuZGxlID0gdGhpcy4kaGFuZGxlWzBdLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpW3BhcmFtXSAvIDIsXHJcbiAgICAgICAgICBiYXJEaW0gPSB0aGlzLiRlbGVtZW50WzBdLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpW3BhcmFtXSxcclxuICAgICAgICAgIHdpbmRvd1Njcm9sbCA9IHZlcnRpY2FsID8gJCh3aW5kb3cpLnNjcm9sbFRvcCgpIDogJCh3aW5kb3cpLnNjcm9sbExlZnQoKTtcclxuXHJcblxyXG4gICAgICB2YXIgZWxlbU9mZnNldCA9IHRoaXMuJGVsZW1lbnQub2Zmc2V0KClbZGlyZWN0aW9uXTtcclxuXHJcbiAgICAgIC8vIHRvdWNoIGV2ZW50cyBlbXVsYXRlZCBieSB0aGUgdG91Y2ggdXRpbCBnaXZlIHBvc2l0aW9uIHJlbGF0aXZlIHRvIHNjcmVlbiwgYWRkIHdpbmRvdy5zY3JvbGwgdG8gZXZlbnQgY29vcmRpbmF0ZXMuLi5cclxuICAgICAgLy8gYmVzdCB3YXkgdG8gZ3Vlc3MgdGhpcyBpcyBzaW11bGF0ZWQgaXMgaWYgY2xpZW50WSA9PSBwYWdlWVxyXG4gICAgICBpZiAoZS5jbGllbnRZID09PSBlLnBhZ2VZKSB7IGV2ZW50T2Zmc2V0ID0gZXZlbnRPZmZzZXQgKyB3aW5kb3dTY3JvbGw7IH1cclxuICAgICAgdmFyIGV2ZW50RnJvbUJhciA9IGV2ZW50T2Zmc2V0IC0gZWxlbU9mZnNldDtcclxuICAgICAgdmFyIGJhclhZO1xyXG4gICAgICBpZiAoZXZlbnRGcm9tQmFyIDwgMCkge1xyXG4gICAgICAgIGJhclhZID0gMDtcclxuICAgICAgfSBlbHNlIGlmIChldmVudEZyb21CYXIgPiBiYXJEaW0pIHtcclxuICAgICAgICBiYXJYWSA9IGJhckRpbTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBiYXJYWSA9IGV2ZW50RnJvbUJhcjtcclxuICAgICAgfVxyXG4gICAgICB2YXIgb2Zmc2V0UGN0ID0gcGVyY2VudChiYXJYWSwgYmFyRGltKTtcclxuXHJcbiAgICAgIHZhbHVlID0gdGhpcy5fdmFsdWUob2Zmc2V0UGN0KTtcclxuXHJcbiAgICAgIC8vIHR1cm4gZXZlcnl0aGluZyBhcm91bmQgZm9yIFJUTCwgeWF5IG1hdGghXHJcbiAgICAgIGlmIChGb3VuZGF0aW9uLnJ0bCgpICYmICF0aGlzLm9wdGlvbnMudmVydGljYWwpIHt2YWx1ZSA9IHRoaXMub3B0aW9ucy5lbmQgLSB2YWx1ZTt9XHJcblxyXG4gICAgICB2YWx1ZSA9IF90aGlzLl9hZGp1c3RWYWx1ZShudWxsLCB2YWx1ZSk7XHJcbiAgICAgIC8vYm9vbGVhbiBmbGFnIGZvciB0aGUgc2V0SGFuZGxlUG9zIGZuLCBzcGVjaWZpY2FsbHkgZm9yIHZlcnRpY2FsIHNsaWRlcnNcclxuICAgICAgaGFzVmFsID0gZmFsc2U7XHJcblxyXG4gICAgICBpZiAoISRoYW5kbGUpIHsvL2ZpZ3VyZSBvdXQgd2hpY2ggaGFuZGxlIGl0IGlzLCBwYXNzIGl0IHRvIHRoZSBuZXh0IGZ1bmN0aW9uLlxyXG4gICAgICAgIHZhciBmaXJzdEhuZGxQb3MgPSBhYnNQb3NpdGlvbih0aGlzLiRoYW5kbGUsIGRpcmVjdGlvbiwgYmFyWFksIHBhcmFtKSxcclxuICAgICAgICAgICAgc2VjbmRIbmRsUG9zID0gYWJzUG9zaXRpb24odGhpcy4kaGFuZGxlMiwgZGlyZWN0aW9uLCBiYXJYWSwgcGFyYW0pO1xyXG4gICAgICAgICAgICAkaGFuZGxlID0gZmlyc3RIbmRsUG9zIDw9IHNlY25kSG5kbFBvcyA/IHRoaXMuJGhhbmRsZSA6IHRoaXMuJGhhbmRsZTI7XHJcbiAgICAgIH1cclxuXHJcbiAgICB9IGVsc2Ugey8vY2hhbmdlIGV2ZW50IG9uIGlucHV0XHJcbiAgICAgIHZhbHVlID0gdGhpcy5fYWRqdXN0VmFsdWUobnVsbCwgdmFsKTtcclxuICAgICAgaGFzVmFsID0gdHJ1ZTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLl9zZXRIYW5kbGVQb3MoJGhhbmRsZSwgdmFsdWUsIGhhc1ZhbCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGp1c3RlcyB2YWx1ZSBmb3IgaGFuZGxlIGluIHJlZ2FyZCB0byBzdGVwIHZhbHVlLiByZXR1cm5zIGFkanVzdGVkIHZhbHVlXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gJGhhbmRsZSAtIHRoZSBzZWxlY3RlZCBoYW5kbGUuXHJcbiAgICogQHBhcmFtIHtOdW1iZXJ9IHZhbHVlIC0gdmFsdWUgdG8gYWRqdXN0LiB1c2VkIGlmICRoYW5kbGUgaXMgZmFsc3lcclxuICAgKi9cclxuICBfYWRqdXN0VmFsdWUoJGhhbmRsZSwgdmFsdWUpIHtcclxuICAgIHZhciB2YWwsXHJcbiAgICAgIHN0ZXAgPSB0aGlzLm9wdGlvbnMuc3RlcCxcclxuICAgICAgZGl2ID0gcGFyc2VGbG9hdChzdGVwLzIpLFxyXG4gICAgICBsZWZ0LCBwcmV2X3ZhbCwgbmV4dF92YWw7XHJcbiAgICBpZiAoISEkaGFuZGxlKSB7XHJcbiAgICAgIHZhbCA9IHBhcnNlRmxvYXQoJGhhbmRsZS5hdHRyKCdhcmlhLXZhbHVlbm93JykpO1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgIHZhbCA9IHZhbHVlO1xyXG4gICAgfVxyXG4gICAgbGVmdCA9IHZhbCAlIHN0ZXA7XHJcbiAgICBwcmV2X3ZhbCA9IHZhbCAtIGxlZnQ7XHJcbiAgICBuZXh0X3ZhbCA9IHByZXZfdmFsICsgc3RlcDtcclxuICAgIGlmIChsZWZ0ID09PSAwKSB7XHJcbiAgICAgIHJldHVybiB2YWw7XHJcbiAgICB9XHJcbiAgICB2YWwgPSB2YWwgPj0gcHJldl92YWwgKyBkaXYgPyBuZXh0X3ZhbCA6IHByZXZfdmFsO1xyXG4gICAgcmV0dXJuIHZhbDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMgZXZlbnQgbGlzdGVuZXJzIHRvIHRoZSBzbGlkZXIgZWxlbWVudHMuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfZXZlbnRzKCkge1xyXG4gICAgdGhpcy5fZXZlbnRzRm9ySGFuZGxlKHRoaXMuJGhhbmRsZSk7XHJcbiAgICBpZih0aGlzLmhhbmRsZXNbMV0pIHtcclxuICAgICAgdGhpcy5fZXZlbnRzRm9ySGFuZGxlKHRoaXMuJGhhbmRsZTIpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMgZXZlbnQgbGlzdGVuZXJzIGEgcGFydGljdWxhciBoYW5kbGVcclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSAkaGFuZGxlIC0gdGhlIGN1cnJlbnQgaGFuZGxlIHRvIGFwcGx5IGxpc3RlbmVycyB0by5cclxuICAgKi9cclxuICBfZXZlbnRzRm9ySGFuZGxlKCRoYW5kbGUpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXMsXHJcbiAgICAgICAgY3VySGFuZGxlLFxyXG4gICAgICAgIHRpbWVyO1xyXG5cclxuICAgICAgdGhpcy5pbnB1dHMub2ZmKCdjaGFuZ2UuemYuc2xpZGVyJykub24oJ2NoYW5nZS56Zi5zbGlkZXInLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgdmFyIGlkeCA9IF90aGlzLmlucHV0cy5pbmRleCgkKHRoaXMpKTtcclxuICAgICAgICBfdGhpcy5faGFuZGxlRXZlbnQoZSwgX3RoaXMuaGFuZGxlcy5lcShpZHgpLCAkKHRoaXMpLnZhbCgpKTtcclxuICAgICAgfSk7XHJcblxyXG4gICAgICBpZiAodGhpcy5vcHRpb25zLmNsaWNrU2VsZWN0KSB7XHJcbiAgICAgICAgdGhpcy4kZWxlbWVudC5vZmYoJ2NsaWNrLnpmLnNsaWRlcicpLm9uKCdjbGljay56Zi5zbGlkZXInLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgICBpZiAoX3RoaXMuJGVsZW1lbnQuZGF0YSgnZHJhZ2dpbmcnKSkgeyByZXR1cm4gZmFsc2U7IH1cclxuXHJcbiAgICAgICAgICBpZiAoISQoZS50YXJnZXQpLmlzKCdbZGF0YS1zbGlkZXItaGFuZGxlXScpKSB7XHJcbiAgICAgICAgICAgIGlmIChfdGhpcy5vcHRpb25zLmRvdWJsZVNpZGVkKSB7XHJcbiAgICAgICAgICAgICAgX3RoaXMuX2hhbmRsZUV2ZW50KGUpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgIF90aGlzLl9oYW5kbGVFdmVudChlLCBfdGhpcy4kaGFuZGxlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5kcmFnZ2FibGUpIHtcclxuICAgICAgdGhpcy5oYW5kbGVzLmFkZFRvdWNoKCk7XHJcblxyXG4gICAgICB2YXIgJGJvZHkgPSAkKCdib2R5Jyk7XHJcbiAgICAgICRoYW5kbGVcclxuICAgICAgICAub2ZmKCdtb3VzZWRvd24uemYuc2xpZGVyJylcclxuICAgICAgICAub24oJ21vdXNlZG93bi56Zi5zbGlkZXInLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgICAkaGFuZGxlLmFkZENsYXNzKCdpcy1kcmFnZ2luZycpO1xyXG4gICAgICAgICAgX3RoaXMuJGZpbGwuYWRkQ2xhc3MoJ2lzLWRyYWdnaW5nJyk7Ly9cclxuICAgICAgICAgIF90aGlzLiRlbGVtZW50LmRhdGEoJ2RyYWdnaW5nJywgdHJ1ZSk7XHJcblxyXG4gICAgICAgICAgY3VySGFuZGxlID0gJChlLmN1cnJlbnRUYXJnZXQpO1xyXG5cclxuICAgICAgICAgICRib2R5Lm9uKCdtb3VzZW1vdmUuemYuc2xpZGVyJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICAgIF90aGlzLl9oYW5kbGVFdmVudChlLCBjdXJIYW5kbGUpO1xyXG5cclxuICAgICAgICAgIH0pLm9uKCdtb3VzZXVwLnpmLnNsaWRlcicsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICAgICAgX3RoaXMuX2hhbmRsZUV2ZW50KGUsIGN1ckhhbmRsZSk7XHJcblxyXG4gICAgICAgICAgICAkaGFuZGxlLnJlbW92ZUNsYXNzKCdpcy1kcmFnZ2luZycpO1xyXG4gICAgICAgICAgICBfdGhpcy4kZmlsbC5yZW1vdmVDbGFzcygnaXMtZHJhZ2dpbmcnKTtcclxuICAgICAgICAgICAgX3RoaXMuJGVsZW1lbnQuZGF0YSgnZHJhZ2dpbmcnLCBmYWxzZSk7XHJcblxyXG4gICAgICAgICAgICAkYm9keS5vZmYoJ21vdXNlbW92ZS56Zi5zbGlkZXIgbW91c2V1cC56Zi5zbGlkZXInKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICB9KVxyXG4gICAgICAvLyBwcmV2ZW50IGV2ZW50cyB0cmlnZ2VyZWQgYnkgdG91Y2hcclxuICAgICAgLm9uKCdzZWxlY3RzdGFydC56Zi5zbGlkZXIgdG91Y2htb3ZlLnpmLnNsaWRlcicsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgICRoYW5kbGUub2ZmKCdrZXlkb3duLnpmLnNsaWRlcicpLm9uKCdrZXlkb3duLnpmLnNsaWRlcicsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgdmFyIF8kaGFuZGxlID0gJCh0aGlzKSxcclxuICAgICAgICAgIGlkeCA9IF90aGlzLm9wdGlvbnMuZG91YmxlU2lkZWQgPyBfdGhpcy5oYW5kbGVzLmluZGV4KF8kaGFuZGxlKSA6IDAsXHJcbiAgICAgICAgICBvbGRWYWx1ZSA9IHBhcnNlRmxvYXQoX3RoaXMuaW5wdXRzLmVxKGlkeCkudmFsKCkpLFxyXG4gICAgICAgICAgbmV3VmFsdWU7XHJcblxyXG4gICAgICAvLyBoYW5kbGUga2V5Ym9hcmQgZXZlbnQgd2l0aCBrZXlib2FyZCB1dGlsXHJcbiAgICAgIEZvdW5kYXRpb24uS2V5Ym9hcmQuaGFuZGxlS2V5KGUsICdTbGlkZXInLCB7XHJcbiAgICAgICAgZGVjcmVhc2U6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgbmV3VmFsdWUgPSBvbGRWYWx1ZSAtIF90aGlzLm9wdGlvbnMuc3RlcDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGluY3JlYXNlOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgIG5ld1ZhbHVlID0gb2xkVmFsdWUgKyBfdGhpcy5vcHRpb25zLnN0ZXA7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBkZWNyZWFzZV9mYXN0OiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgIG5ld1ZhbHVlID0gb2xkVmFsdWUgLSBfdGhpcy5vcHRpb25zLnN0ZXAgKiAxMDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGluY3JlYXNlX2Zhc3Q6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgbmV3VmFsdWUgPSBvbGRWYWx1ZSArIF90aGlzLm9wdGlvbnMuc3RlcCAqIDEwO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgaGFuZGxlZDogZnVuY3Rpb24oKSB7IC8vIG9ubHkgc2V0IGhhbmRsZSBwb3Mgd2hlbiBldmVudCB3YXMgaGFuZGxlZCBzcGVjaWFsbHlcclxuICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgIF90aGlzLl9zZXRIYW5kbGVQb3MoXyRoYW5kbGUsIG5ld1ZhbHVlLCB0cnVlKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgICAvKmlmIChuZXdWYWx1ZSkgeyAvLyBpZiBwcmVzc2VkIGtleSBoYXMgc3BlY2lhbCBmdW5jdGlvbiwgdXBkYXRlIHZhbHVlXHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIF90aGlzLl9zZXRIYW5kbGVQb3MoXyRoYW5kbGUsIG5ld1ZhbHVlKTtcclxuICAgICAgfSovXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlc3Ryb3lzIHRoZSBzbGlkZXIgcGx1Z2luLlxyXG4gICAqL1xyXG4gIGRlc3Ryb3koKSB7XHJcbiAgICB0aGlzLmhhbmRsZXMub2ZmKCcuemYuc2xpZGVyJyk7XHJcbiAgICB0aGlzLmlucHV0cy5vZmYoJy56Zi5zbGlkZXInKTtcclxuICAgIHRoaXMuJGVsZW1lbnQub2ZmKCcuemYuc2xpZGVyJyk7XHJcblxyXG4gICAgY2xlYXJUaW1lb3V0KHRoaXMudGltZW91dCk7XHJcblxyXG4gICAgRm91bmRhdGlvbi51bnJlZ2lzdGVyUGx1Z2luKHRoaXMpO1xyXG4gIH1cclxufVxyXG5cclxuU2xpZGVyLmRlZmF1bHRzID0ge1xyXG4gIC8qKlxyXG4gICAqIE1pbmltdW0gdmFsdWUgZm9yIHRoZSBzbGlkZXIgc2NhbGUuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDBcclxuICAgKi9cclxuICBzdGFydDogMCxcclxuICAvKipcclxuICAgKiBNYXhpbXVtIHZhbHVlIGZvciB0aGUgc2xpZGVyIHNjYWxlLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAxMDBcclxuICAgKi9cclxuICBlbmQ6IDEwMCxcclxuICAvKipcclxuICAgKiBNaW5pbXVtIHZhbHVlIGNoYW5nZSBwZXIgY2hhbmdlIGV2ZW50LlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAxXHJcbiAgICovXHJcbiAgc3RlcDogMSxcclxuICAvKipcclxuICAgKiBWYWx1ZSBhdCB3aGljaCB0aGUgaGFuZGxlL2lucHV0ICoobGVmdCBoYW5kbGUvZmlyc3QgaW5wdXQpKiBzaG91bGQgYmUgc2V0IHRvIG9uIGluaXRpYWxpemF0aW9uLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAwXHJcbiAgICovXHJcbiAgaW5pdGlhbFN0YXJ0OiAwLFxyXG4gIC8qKlxyXG4gICAqIFZhbHVlIGF0IHdoaWNoIHRoZSByaWdodCBoYW5kbGUvc2Vjb25kIGlucHV0IHNob3VsZCBiZSBzZXQgdG8gb24gaW5pdGlhbGl6YXRpb24uXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDEwMFxyXG4gICAqL1xyXG4gIGluaXRpYWxFbmQ6IDEwMCxcclxuICAvKipcclxuICAgKiBBbGxvd3MgdGhlIGlucHV0IHRvIGJlIGxvY2F0ZWQgb3V0c2lkZSB0aGUgY29udGFpbmVyIGFuZCB2aXNpYmxlLiBTZXQgdG8gYnkgdGhlIEpTXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgYmluZGluZzogZmFsc2UsXHJcbiAgLyoqXHJcbiAgICogQWxsb3dzIHRoZSB1c2VyIHRvIGNsaWNrL3RhcCBvbiB0aGUgc2xpZGVyIGJhciB0byBzZWxlY3QgYSB2YWx1ZS5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgdHJ1ZVxyXG4gICAqL1xyXG4gIGNsaWNrU2VsZWN0OiB0cnVlLFxyXG4gIC8qKlxyXG4gICAqIFNldCB0byB0cnVlIGFuZCB1c2UgdGhlIGB2ZXJ0aWNhbGAgY2xhc3MgdG8gY2hhbmdlIGFsaWdubWVudCB0byB2ZXJ0aWNhbC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICB2ZXJ0aWNhbDogZmFsc2UsXHJcbiAgLyoqXHJcbiAgICogQWxsb3dzIHRoZSB1c2VyIHRvIGRyYWcgdGhlIHNsaWRlciBoYW5kbGUocykgdG8gc2VsZWN0IGEgdmFsdWUuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIHRydWVcclxuICAgKi9cclxuICBkcmFnZ2FibGU6IHRydWUsXHJcbiAgLyoqXHJcbiAgICogRGlzYWJsZXMgdGhlIHNsaWRlciBhbmQgcHJldmVudHMgZXZlbnQgbGlzdGVuZXJzIGZyb20gYmVpbmcgYXBwbGllZC4gRG91YmxlIGNoZWNrZWQgYnkgSlMgd2l0aCBgZGlzYWJsZWRDbGFzc2AuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgZGlzYWJsZWQ6IGZhbHNlLFxyXG4gIC8qKlxyXG4gICAqIEFsbG93cyB0aGUgdXNlIG9mIHR3byBoYW5kbGVzLiBEb3VibGUgY2hlY2tlZCBieSB0aGUgSlMuIENoYW5nZXMgc29tZSBsb2dpYyBoYW5kbGluZy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBkb3VibGVTaWRlZDogZmFsc2UsXHJcbiAgLyoqXHJcbiAgICogUG90ZW50aWFsIGZ1dHVyZSBmZWF0dXJlLlxyXG4gICAqL1xyXG4gIC8vIHN0ZXBzOiAxMDAsXHJcbiAgLyoqXHJcbiAgICogTnVtYmVyIG9mIGRlY2ltYWwgcGxhY2VzIHRoZSBwbHVnaW4gc2hvdWxkIGdvIHRvIGZvciBmbG9hdGluZyBwb2ludCBwcmVjaXNpb24uXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDJcclxuICAgKi9cclxuICBkZWNpbWFsOiAyLFxyXG4gIC8qKlxyXG4gICAqIFRpbWUgZGVsYXkgZm9yIGRyYWdnZWQgZWxlbWVudHMuXHJcbiAgICovXHJcbiAgLy8gZHJhZ0RlbGF5OiAwLFxyXG4gIC8qKlxyXG4gICAqIFRpbWUsIGluIG1zLCB0byBhbmltYXRlIHRoZSBtb3ZlbWVudCBvZiBhIHNsaWRlciBoYW5kbGUgaWYgdXNlciBjbGlja3MvdGFwcyBvbiB0aGUgYmFyLiBOZWVkcyB0byBiZSBtYW51YWxseSBzZXQgaWYgdXBkYXRpbmcgdGhlIHRyYW5zaXRpb24gdGltZSBpbiB0aGUgU2FzcyBzZXR0aW5ncy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgMjAwXHJcbiAgICovXHJcbiAgbW92ZVRpbWU6IDIwMCwvL3VwZGF0ZSB0aGlzIGlmIGNoYW5naW5nIHRoZSB0cmFuc2l0aW9uIHRpbWUgaW4gdGhlIHNhc3NcclxuICAvKipcclxuICAgKiBDbGFzcyBhcHBsaWVkIHRvIGRpc2FibGVkIHNsaWRlcnMuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICdkaXNhYmxlZCdcclxuICAgKi9cclxuICBkaXNhYmxlZENsYXNzOiAnZGlzYWJsZWQnLFxyXG4gIC8qKlxyXG4gICAqIFdpbGwgaW52ZXJ0IHRoZSBkZWZhdWx0IGxheW91dCBmb3IgYSB2ZXJ0aWNhbDxzcGFuIGRhdGEtdG9vbHRpcCB0aXRsZT1cIndobyB3b3VsZCBkbyB0aGlzPz8/XCI+IDwvc3Bhbj5zbGlkZXIuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgaW52ZXJ0VmVydGljYWw6IGZhbHNlLFxyXG4gIC8qKlxyXG4gICAqIE1pbGxpc2Vjb25kcyBiZWZvcmUgdGhlIGBjaGFuZ2VkLnpmLXNsaWRlcmAgZXZlbnQgaXMgdHJpZ2dlcmVkIGFmdGVyIHZhbHVlIGNoYW5nZS5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgNTAwXHJcbiAgICovXHJcbiAgY2hhbmdlZERlbGF5OiA1MDAsXHJcbiAgLyoqXHJcbiAgKiBCYXNldmFsdWUgZm9yIG5vbi1saW5lYXIgc2xpZGVyc1xyXG4gICogQG9wdGlvblxyXG4gICogQGV4YW1wbGUgNVxyXG4gICovXHJcbiAgbm9uTGluZWFyQmFzZTogNSxcclxuICAvKipcclxuICAqIEJhc2V2YWx1ZSBmb3Igbm9uLWxpbmVhciBzbGlkZXJzLCBwb3NzaWJsZSB2YWx1ZXMgYXJlOiAnbGluZWFyJywgJ3BvdycgJiAnbG9nJy4gUG93IGFuZCBMb2cgdXNlIHRoZSBub25MaW5lYXJCYXNlIHNldHRpbmcuXHJcbiAgKiBAb3B0aW9uXHJcbiAgKiBAZXhhbXBsZSAnbGluZWFyJ1xyXG4gICovXHJcbiAgcG9zaXRpb25WYWx1ZUZ1bmN0aW9uOiAnbGluZWFyJyxcclxufTtcclxuXHJcbmZ1bmN0aW9uIHBlcmNlbnQoZnJhYywgbnVtKSB7XHJcbiAgcmV0dXJuIChmcmFjIC8gbnVtKTtcclxufVxyXG5mdW5jdGlvbiBhYnNQb3NpdGlvbigkaGFuZGxlLCBkaXIsIGNsaWNrUG9zLCBwYXJhbSkge1xyXG4gIHJldHVybiBNYXRoLmFicygoJGhhbmRsZS5wb3NpdGlvbigpW2Rpcl0gKyAoJGhhbmRsZVtwYXJhbV0oKSAvIDIpKSAtIGNsaWNrUG9zKTtcclxufVxyXG5mdW5jdGlvbiBiYXNlTG9nKGJhc2UsIHZhbHVlKSB7XHJcbiAgcmV0dXJuIE1hdGgubG9nKHZhbHVlKS9NYXRoLmxvZyhiYXNlKVxyXG59XHJcblxyXG4vLyBXaW5kb3cgZXhwb3J0c1xyXG5Gb3VuZGF0aW9uLnBsdWdpbihTbGlkZXIsICdTbGlkZXInKTtcclxuXHJcbn0oalF1ZXJ5KTtcclxuXHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbiFmdW5jdGlvbigkKSB7XHJcblxyXG4vKipcclxuICogU3RpY2t5IG1vZHVsZS5cclxuICogQG1vZHVsZSBmb3VuZGF0aW9uLnN0aWNreVxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLnRyaWdnZXJzXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwubWVkaWFRdWVyeVxyXG4gKi9cclxuXHJcbmNsYXNzIFN0aWNreSB7XHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlcyBhIG5ldyBpbnN0YW5jZSBvZiBhIHN0aWNreSB0aGluZy5cclxuICAgKiBAY2xhc3NcclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gZWxlbWVudCAtIGpRdWVyeSBvYmplY3QgdG8gbWFrZSBzdGlja3kuXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgLSBvcHRpb25zIG9iamVjdCBwYXNzZWQgd2hlbiBjcmVhdGluZyB0aGUgZWxlbWVudCBwcm9ncmFtbWF0aWNhbGx5LlxyXG4gICAqL1xyXG4gIGNvbnN0cnVjdG9yKGVsZW1lbnQsIG9wdGlvbnMpIHtcclxuICAgIHRoaXMuJGVsZW1lbnQgPSBlbGVtZW50O1xyXG4gICAgdGhpcy5vcHRpb25zID0gJC5leHRlbmQoe30sIFN0aWNreS5kZWZhdWx0cywgdGhpcy4kZWxlbWVudC5kYXRhKCksIG9wdGlvbnMpO1xyXG5cclxuICAgIHRoaXMuX2luaXQoKTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLnJlZ2lzdGVyUGx1Z2luKHRoaXMsICdTdGlja3knKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEluaXRpYWxpemVzIHRoZSBzdGlja3kgZWxlbWVudCBieSBhZGRpbmcgY2xhc3NlcywgZ2V0dGluZy9zZXR0aW5nIGRpbWVuc2lvbnMsIGJyZWFrcG9pbnRzIGFuZCBhdHRyaWJ1dGVzXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfaW5pdCgpIHtcclxuICAgIHZhciAkcGFyZW50ID0gdGhpcy4kZWxlbWVudC5wYXJlbnQoJ1tkYXRhLXN0aWNreS1jb250YWluZXJdJyksXHJcbiAgICAgICAgaWQgPSB0aGlzLiRlbGVtZW50WzBdLmlkIHx8IEZvdW5kYXRpb24uR2V0WW9EaWdpdHMoNiwgJ3N0aWNreScpLFxyXG4gICAgICAgIF90aGlzID0gdGhpcztcclxuXHJcbiAgICBpZiAoISRwYXJlbnQubGVuZ3RoKSB7XHJcbiAgICAgIHRoaXMud2FzV3JhcHBlZCA9IHRydWU7XHJcbiAgICB9XHJcbiAgICB0aGlzLiRjb250YWluZXIgPSAkcGFyZW50Lmxlbmd0aCA/ICRwYXJlbnQgOiAkKHRoaXMub3B0aW9ucy5jb250YWluZXIpLndyYXBJbm5lcih0aGlzLiRlbGVtZW50KTtcclxuICAgIHRoaXMuJGNvbnRhaW5lci5hZGRDbGFzcyh0aGlzLm9wdGlvbnMuY29udGFpbmVyQ2xhc3MpO1xyXG5cclxuICAgIHRoaXMuJGVsZW1lbnQuYWRkQ2xhc3ModGhpcy5vcHRpb25zLnN0aWNreUNsYXNzKVxyXG4gICAgICAgICAgICAgICAgIC5hdHRyKHsnZGF0YS1yZXNpemUnOiBpZH0pO1xyXG5cclxuICAgIHRoaXMuc2Nyb2xsQ291bnQgPSB0aGlzLm9wdGlvbnMuY2hlY2tFdmVyeTtcclxuICAgIHRoaXMuaXNTdHVjayA9IGZhbHNlO1xyXG4gICAgJCh3aW5kb3cpLm9uZSgnbG9hZC56Zi5zdGlja3knLCBmdW5jdGlvbigpe1xyXG4gICAgICAvL1dlIGNhbGN1bGF0ZSB0aGUgY29udGFpbmVyIGhlaWdodCB0byBoYXZlIGNvcnJlY3QgdmFsdWVzIGZvciBhbmNob3IgcG9pbnRzIG9mZnNldCBjYWxjdWxhdGlvbi5cclxuICAgICAgX3RoaXMuY29udGFpbmVySGVpZ2h0ID0gX3RoaXMuJGVsZW1lbnQuY3NzKFwiZGlzcGxheVwiKSA9PSBcIm5vbmVcIiA/IDAgOiBfdGhpcy4kZWxlbWVudFswXS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHQ7XHJcbiAgICAgIF90aGlzLiRjb250YWluZXIuY3NzKCdoZWlnaHQnLCBfdGhpcy5jb250YWluZXJIZWlnaHQpO1xyXG4gICAgICBfdGhpcy5lbGVtSGVpZ2h0ID0gX3RoaXMuY29udGFpbmVySGVpZ2h0O1xyXG4gICAgICBpZihfdGhpcy5vcHRpb25zLmFuY2hvciAhPT0gJycpe1xyXG4gICAgICAgIF90aGlzLiRhbmNob3IgPSAkKCcjJyArIF90aGlzLm9wdGlvbnMuYW5jaG9yKTtcclxuICAgICAgfWVsc2V7XHJcbiAgICAgICAgX3RoaXMuX3BhcnNlUG9pbnRzKCk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIF90aGlzLl9zZXRTaXplcyhmdW5jdGlvbigpe1xyXG4gICAgICAgIHZhciBzY3JvbGwgPSB3aW5kb3cucGFnZVlPZmZzZXQ7XHJcbiAgICAgICAgX3RoaXMuX2NhbGMoZmFsc2UsIHNjcm9sbCk7XHJcbiAgICAgICAgLy9VbnN0aWNrIHRoZSBlbGVtZW50IHdpbGwgZW5zdXJlIHRoYXQgcHJvcGVyIGNsYXNzZXMgYXJlIHNldC5cclxuICAgICAgICBpZiAoIV90aGlzLmlzU3R1Y2spIHtcclxuICAgICAgICAgIF90aGlzLl9yZW1vdmVTdGlja3koKHNjcm9sbCA+PSBfdGhpcy50b3BQb2ludCkgPyBmYWxzZSA6IHRydWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICAgIF90aGlzLl9ldmVudHMoaWQuc3BsaXQoJy0nKS5yZXZlcnNlKCkuam9pbignLScpKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSWYgdXNpbmcgbXVsdGlwbGUgZWxlbWVudHMgYXMgYW5jaG9ycywgY2FsY3VsYXRlcyB0aGUgdG9wIGFuZCBib3R0b20gcGl4ZWwgdmFsdWVzIHRoZSBzdGlja3kgdGhpbmcgc2hvdWxkIHN0aWNrIGFuZCB1bnN0aWNrIG9uLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX3BhcnNlUG9pbnRzKCkge1xyXG4gICAgdmFyIHRvcCA9IHRoaXMub3B0aW9ucy50b3BBbmNob3IgPT0gXCJcIiA/IDEgOiB0aGlzLm9wdGlvbnMudG9wQW5jaG9yLFxyXG4gICAgICAgIGJ0bSA9IHRoaXMub3B0aW9ucy5idG1BbmNob3I9PSBcIlwiID8gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbEhlaWdodCA6IHRoaXMub3B0aW9ucy5idG1BbmNob3IsXHJcbiAgICAgICAgcHRzID0gW3RvcCwgYnRtXSxcclxuICAgICAgICBicmVha3MgPSB7fTtcclxuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBwdHMubGVuZ3RoOyBpIDwgbGVuICYmIHB0c1tpXTsgaSsrKSB7XHJcbiAgICAgIHZhciBwdDtcclxuICAgICAgaWYgKHR5cGVvZiBwdHNbaV0gPT09ICdudW1iZXInKSB7XHJcbiAgICAgICAgcHQgPSBwdHNbaV07XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdmFyIHBsYWNlID0gcHRzW2ldLnNwbGl0KCc6JyksXHJcbiAgICAgICAgICAgIGFuY2hvciA9ICQoYCMke3BsYWNlWzBdfWApO1xyXG5cclxuICAgICAgICBwdCA9IGFuY2hvci5vZmZzZXQoKS50b3A7XHJcbiAgICAgICAgaWYgKHBsYWNlWzFdICYmIHBsYWNlWzFdLnRvTG93ZXJDYXNlKCkgPT09ICdib3R0b20nKSB7XHJcbiAgICAgICAgICBwdCArPSBhbmNob3JbMF0uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkuaGVpZ2h0O1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBicmVha3NbaV0gPSBwdDtcclxuICAgIH1cclxuXHJcblxyXG4gICAgdGhpcy5wb2ludHMgPSBicmVha3M7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGRzIGV2ZW50IGhhbmRsZXJzIGZvciB0aGUgc2Nyb2xsaW5nIGVsZW1lbnQuXHJcbiAgICogQHByaXZhdGVcclxuICAgKiBAcGFyYW0ge1N0cmluZ30gaWQgLSBwc3VlZG8tcmFuZG9tIGlkIGZvciB1bmlxdWUgc2Nyb2xsIGV2ZW50IGxpc3RlbmVyLlxyXG4gICAqL1xyXG4gIF9ldmVudHMoaWQpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXMsXHJcbiAgICAgICAgc2Nyb2xsTGlzdGVuZXIgPSB0aGlzLnNjcm9sbExpc3RlbmVyID0gYHNjcm9sbC56Zi4ke2lkfWA7XHJcbiAgICBpZiAodGhpcy5pc09uKSB7IHJldHVybjsgfVxyXG4gICAgaWYgKHRoaXMuY2FuU3RpY2spIHtcclxuICAgICAgdGhpcy5pc09uID0gdHJ1ZTtcclxuICAgICAgJCh3aW5kb3cpLm9mZihzY3JvbGxMaXN0ZW5lcilcclxuICAgICAgICAgICAgICAgLm9uKHNjcm9sbExpc3RlbmVyLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgICAgICAgICAgaWYgKF90aGlzLnNjcm9sbENvdW50ID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICBfdGhpcy5zY3JvbGxDb3VudCA9IF90aGlzLm9wdGlvbnMuY2hlY2tFdmVyeTtcclxuICAgICAgICAgICAgICAgICAgIF90aGlzLl9zZXRTaXplcyhmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICAgX3RoaXMuX2NhbGMoZmFsc2UsIHdpbmRvdy5wYWdlWU9mZnNldCk7XHJcbiAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgX3RoaXMuc2Nyb2xsQ291bnQtLTtcclxuICAgICAgICAgICAgICAgICAgIF90aGlzLl9jYWxjKGZhbHNlLCB3aW5kb3cucGFnZVlPZmZzZXQpO1xyXG4gICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLiRlbGVtZW50Lm9mZigncmVzaXplbWUuemYudHJpZ2dlcicpXHJcbiAgICAgICAgICAgICAgICAgLm9uKCdyZXNpemVtZS56Zi50cmlnZ2VyJywgZnVuY3Rpb24oZSwgZWwpIHtcclxuICAgICAgICAgICAgICAgICAgICAgX3RoaXMuX3NldFNpemVzKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgIF90aGlzLl9jYWxjKGZhbHNlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICBpZiAoX3RoaXMuY2FuU3RpY2spIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghX3RoaXMuaXNPbikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBfdGhpcy5fZXZlbnRzKGlkKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKF90aGlzLmlzT24pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgIF90aGlzLl9wYXVzZUxpc3RlbmVycyhzY3JvbGxMaXN0ZW5lcik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVtb3ZlcyBldmVudCBoYW5kbGVycyBmb3Igc2Nyb2xsIGFuZCBjaGFuZ2UgZXZlbnRzIG9uIGFuY2hvci5cclxuICAgKiBAZmlyZXMgU3RpY2t5I3BhdXNlXHJcbiAgICogQHBhcmFtIHtTdHJpbmd9IHNjcm9sbExpc3RlbmVyIC0gdW5pcXVlLCBuYW1lc3BhY2VkIHNjcm9sbCBsaXN0ZW5lciBhdHRhY2hlZCB0byBgd2luZG93YFxyXG4gICAqL1xyXG4gIF9wYXVzZUxpc3RlbmVycyhzY3JvbGxMaXN0ZW5lcikge1xyXG4gICAgdGhpcy5pc09uID0gZmFsc2U7XHJcbiAgICAkKHdpbmRvdykub2ZmKHNjcm9sbExpc3RlbmVyKTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIEZpcmVzIHdoZW4gdGhlIHBsdWdpbiBpcyBwYXVzZWQgZHVlIHRvIHJlc2l6ZSBldmVudCBzaHJpbmtpbmcgdGhlIHZpZXcuXHJcbiAgICAgKiBAZXZlbnQgU3RpY2t5I3BhdXNlXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICovXHJcbiAgICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdwYXVzZS56Zi5zdGlja3knKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENhbGxlZCBvbiBldmVyeSBgc2Nyb2xsYCBldmVudCBhbmQgb24gYF9pbml0YFxyXG4gICAqIGZpcmVzIGZ1bmN0aW9ucyBiYXNlZCBvbiBib29sZWFucyBhbmQgY2FjaGVkIHZhbHVlc1xyXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gY2hlY2tTaXplcyAtIHRydWUgaWYgcGx1Z2luIHNob3VsZCByZWNhbGN1bGF0ZSBzaXplcyBhbmQgYnJlYWtwb2ludHMuXHJcbiAgICogQHBhcmFtIHtOdW1iZXJ9IHNjcm9sbCAtIGN1cnJlbnQgc2Nyb2xsIHBvc2l0aW9uIHBhc3NlZCBmcm9tIHNjcm9sbCBldmVudCBjYiBmdW5jdGlvbi4gSWYgbm90IHBhc3NlZCwgZGVmYXVsdHMgdG8gYHdpbmRvdy5wYWdlWU9mZnNldGAuXHJcbiAgICovXHJcbiAgX2NhbGMoY2hlY2tTaXplcywgc2Nyb2xsKSB7XHJcbiAgICBpZiAoY2hlY2tTaXplcykgeyB0aGlzLl9zZXRTaXplcygpOyB9XHJcblxyXG4gICAgaWYgKCF0aGlzLmNhblN0aWNrKSB7XHJcbiAgICAgIGlmICh0aGlzLmlzU3R1Y2spIHtcclxuICAgICAgICB0aGlzLl9yZW1vdmVTdGlja3kodHJ1ZSk7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICghc2Nyb2xsKSB7IHNjcm9sbCA9IHdpbmRvdy5wYWdlWU9mZnNldDsgfVxyXG5cclxuICAgIGlmIChzY3JvbGwgPj0gdGhpcy50b3BQb2ludCkge1xyXG4gICAgICBpZiAoc2Nyb2xsIDw9IHRoaXMuYm90dG9tUG9pbnQpIHtcclxuICAgICAgICBpZiAoIXRoaXMuaXNTdHVjaykge1xyXG4gICAgICAgICAgdGhpcy5fc2V0U3RpY2t5KCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGlmICh0aGlzLmlzU3R1Y2spIHtcclxuICAgICAgICAgIHRoaXMuX3JlbW92ZVN0aWNreShmYWxzZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBpZiAodGhpcy5pc1N0dWNrKSB7XHJcbiAgICAgICAgdGhpcy5fcmVtb3ZlU3RpY2t5KHRydWUpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDYXVzZXMgdGhlICRlbGVtZW50IHRvIGJlY29tZSBzdHVjay5cclxuICAgKiBBZGRzIGBwb3NpdGlvbjogZml4ZWQ7YCwgYW5kIGhlbHBlciBjbGFzc2VzLlxyXG4gICAqIEBmaXJlcyBTdGlja3kjc3R1Y2t0b1xyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX3NldFN0aWNreSgpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXMsXHJcbiAgICAgICAgc3RpY2tUbyA9IHRoaXMub3B0aW9ucy5zdGlja1RvLFxyXG4gICAgICAgIG1yZ24gPSBzdGlja1RvID09PSAndG9wJyA/ICdtYXJnaW5Ub3AnIDogJ21hcmdpbkJvdHRvbScsXHJcbiAgICAgICAgbm90U3R1Y2tUbyA9IHN0aWNrVG8gPT09ICd0b3AnID8gJ2JvdHRvbScgOiAndG9wJyxcclxuICAgICAgICBjc3MgPSB7fTtcclxuXHJcbiAgICBjc3NbbXJnbl0gPSBgJHt0aGlzLm9wdGlvbnNbbXJnbl19ZW1gO1xyXG4gICAgY3NzW3N0aWNrVG9dID0gMDtcclxuICAgIGNzc1tub3RTdHVja1RvXSA9ICdhdXRvJztcclxuICAgIHRoaXMuaXNTdHVjayA9IHRydWU7XHJcbiAgICB0aGlzLiRlbGVtZW50LnJlbW92ZUNsYXNzKGBpcy1hbmNob3JlZCBpcy1hdC0ke25vdFN0dWNrVG99YClcclxuICAgICAgICAgICAgICAgICAuYWRkQ2xhc3MoYGlzLXN0dWNrIGlzLWF0LSR7c3RpY2tUb31gKVxyXG4gICAgICAgICAgICAgICAgIC5jc3MoY3NzKVxyXG4gICAgICAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAgICAgICAqIEZpcmVzIHdoZW4gdGhlICRlbGVtZW50IGhhcyBiZWNvbWUgYHBvc2l0aW9uOiBmaXhlZDtgXHJcbiAgICAgICAgICAgICAgICAgICogTmFtZXNwYWNlZCB0byBgdG9wYCBvciBgYm90dG9tYCwgZS5nLiBgc3RpY2t5LnpmLnN0dWNrdG86dG9wYFxyXG4gICAgICAgICAgICAgICAgICAqIEBldmVudCBTdGlja3kjc3R1Y2t0b1xyXG4gICAgICAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICAgICAgIC50cmlnZ2VyKGBzdGlja3kuemYuc3R1Y2t0bzoke3N0aWNrVG99YCk7XHJcbiAgICB0aGlzLiRlbGVtZW50Lm9uKFwidHJhbnNpdGlvbmVuZCB3ZWJraXRUcmFuc2l0aW9uRW5kIG9UcmFuc2l0aW9uRW5kIG90cmFuc2l0aW9uZW5kIE1TVHJhbnNpdGlvbkVuZFwiLCBmdW5jdGlvbigpIHtcclxuICAgICAgX3RoaXMuX3NldFNpemVzKCk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENhdXNlcyB0aGUgJGVsZW1lbnQgdG8gYmVjb21lIHVuc3R1Y2suXHJcbiAgICogUmVtb3ZlcyBgcG9zaXRpb246IGZpeGVkO2AsIGFuZCBoZWxwZXIgY2xhc3Nlcy5cclxuICAgKiBBZGRzIG90aGVyIGhlbHBlciBjbGFzc2VzLlxyXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gaXNUb3AgLSB0ZWxscyB0aGUgZnVuY3Rpb24gaWYgdGhlICRlbGVtZW50IHNob3VsZCBhbmNob3IgdG8gdGhlIHRvcCBvciBib3R0b20gb2YgaXRzICRhbmNob3IgZWxlbWVudC5cclxuICAgKiBAZmlyZXMgU3RpY2t5I3Vuc3R1Y2tmcm9tXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfcmVtb3ZlU3RpY2t5KGlzVG9wKSB7XHJcbiAgICB2YXIgc3RpY2tUbyA9IHRoaXMub3B0aW9ucy5zdGlja1RvLFxyXG4gICAgICAgIHN0aWNrVG9Ub3AgPSBzdGlja1RvID09PSAndG9wJyxcclxuICAgICAgICBjc3MgPSB7fSxcclxuICAgICAgICBhbmNob3JQdCA9ICh0aGlzLnBvaW50cyA/IHRoaXMucG9pbnRzWzFdIC0gdGhpcy5wb2ludHNbMF0gOiB0aGlzLmFuY2hvckhlaWdodCkgLSB0aGlzLmVsZW1IZWlnaHQsXHJcbiAgICAgICAgbXJnbiA9IHN0aWNrVG9Ub3AgPyAnbWFyZ2luVG9wJyA6ICdtYXJnaW5Cb3R0b20nLFxyXG4gICAgICAgIG5vdFN0dWNrVG8gPSBzdGlja1RvVG9wID8gJ2JvdHRvbScgOiAndG9wJyxcclxuICAgICAgICB0b3BPckJvdHRvbSA9IGlzVG9wID8gJ3RvcCcgOiAnYm90dG9tJztcclxuXHJcbiAgICBjc3NbbXJnbl0gPSAwO1xyXG5cclxuICAgIGNzc1snYm90dG9tJ10gPSAnYXV0byc7XHJcbiAgICBpZihpc1RvcCkge1xyXG4gICAgICBjc3NbJ3RvcCddID0gMDtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGNzc1sndG9wJ10gPSBhbmNob3JQdDtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmlzU3R1Y2sgPSBmYWxzZTtcclxuICAgIHRoaXMuJGVsZW1lbnQucmVtb3ZlQ2xhc3MoYGlzLXN0dWNrIGlzLWF0LSR7c3RpY2tUb31gKVxyXG4gICAgICAgICAgICAgICAgIC5hZGRDbGFzcyhgaXMtYW5jaG9yZWQgaXMtYXQtJHt0b3BPckJvdHRvbX1gKVxyXG4gICAgICAgICAgICAgICAgIC5jc3MoY3NzKVxyXG4gICAgICAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAgICAgICAqIEZpcmVzIHdoZW4gdGhlICRlbGVtZW50IGhhcyBiZWNvbWUgYW5jaG9yZWQuXHJcbiAgICAgICAgICAgICAgICAgICogTmFtZXNwYWNlZCB0byBgdG9wYCBvciBgYm90dG9tYCwgZS5nLiBgc3RpY2t5LnpmLnVuc3R1Y2tmcm9tOmJvdHRvbWBcclxuICAgICAgICAgICAgICAgICAgKiBAZXZlbnQgU3RpY2t5I3Vuc3R1Y2tmcm9tXHJcbiAgICAgICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgICAgICAgLnRyaWdnZXIoYHN0aWNreS56Zi51bnN0dWNrZnJvbToke3RvcE9yQm90dG9tfWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0cyB0aGUgJGVsZW1lbnQgYW5kICRjb250YWluZXIgc2l6ZXMgZm9yIHBsdWdpbi5cclxuICAgKiBDYWxscyBgX3NldEJyZWFrUG9pbnRzYC5cclxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYiAtIG9wdGlvbmFsIGNhbGxiYWNrIGZ1bmN0aW9uIHRvIGZpcmUgb24gY29tcGxldGlvbiBvZiBgX3NldEJyZWFrUG9pbnRzYC5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9zZXRTaXplcyhjYikge1xyXG4gICAgdGhpcy5jYW5TdGljayA9IEZvdW5kYXRpb24uTWVkaWFRdWVyeS5pcyh0aGlzLm9wdGlvbnMuc3RpY2t5T24pO1xyXG4gICAgaWYgKCF0aGlzLmNhblN0aWNrKSB7XHJcbiAgICAgIGlmIChjYiAmJiB0eXBlb2YgY2IgPT09ICdmdW5jdGlvbicpIHsgY2IoKTsgfVxyXG4gICAgfVxyXG4gICAgdmFyIF90aGlzID0gdGhpcyxcclxuICAgICAgICBuZXdFbGVtV2lkdGggPSB0aGlzLiRjb250YWluZXJbMF0uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkud2lkdGgsXHJcbiAgICAgICAgY29tcCA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKHRoaXMuJGNvbnRhaW5lclswXSksXHJcbiAgICAgICAgcGRuZ2wgPSBwYXJzZUludChjb21wWydwYWRkaW5nLWxlZnQnXSwgMTApLFxyXG4gICAgICAgIHBkbmdyID0gcGFyc2VJbnQoY29tcFsncGFkZGluZy1yaWdodCddLCAxMCk7XHJcblxyXG4gICAgaWYgKHRoaXMuJGFuY2hvciAmJiB0aGlzLiRhbmNob3IubGVuZ3RoKSB7XHJcbiAgICAgIHRoaXMuYW5jaG9ySGVpZ2h0ID0gdGhpcy4kYW5jaG9yWzBdLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLmhlaWdodDtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuX3BhcnNlUG9pbnRzKCk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy4kZWxlbWVudC5jc3Moe1xyXG4gICAgICAnbWF4LXdpZHRoJzogYCR7bmV3RWxlbVdpZHRoIC0gcGRuZ2wgLSBwZG5ncn1weGBcclxuICAgIH0pO1xyXG5cclxuICAgIHZhciBuZXdDb250YWluZXJIZWlnaHQgPSB0aGlzLiRlbGVtZW50WzBdLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLmhlaWdodCB8fCB0aGlzLmNvbnRhaW5lckhlaWdodDtcclxuICAgIGlmICh0aGlzLiRlbGVtZW50LmNzcyhcImRpc3BsYXlcIikgPT0gXCJub25lXCIpIHtcclxuICAgICAgbmV3Q29udGFpbmVySGVpZ2h0ID0gMDtcclxuICAgIH1cclxuICAgIHRoaXMuY29udGFpbmVySGVpZ2h0ID0gbmV3Q29udGFpbmVySGVpZ2h0O1xyXG4gICAgdGhpcy4kY29udGFpbmVyLmNzcyh7XHJcbiAgICAgIGhlaWdodDogbmV3Q29udGFpbmVySGVpZ2h0XHJcbiAgICB9KTtcclxuICAgIHRoaXMuZWxlbUhlaWdodCA9IG5ld0NvbnRhaW5lckhlaWdodDtcclxuXHJcbiAgICBpZiAoIXRoaXMuaXNTdHVjaykge1xyXG4gICAgICBpZiAodGhpcy4kZWxlbWVudC5oYXNDbGFzcygnaXMtYXQtYm90dG9tJykpIHtcclxuICAgICAgICB2YXIgYW5jaG9yUHQgPSAodGhpcy5wb2ludHMgPyB0aGlzLnBvaW50c1sxXSAtIHRoaXMuJGNvbnRhaW5lci5vZmZzZXQoKS50b3AgOiB0aGlzLmFuY2hvckhlaWdodCkgLSB0aGlzLmVsZW1IZWlnaHQ7XHJcbiAgICAgICAgdGhpcy4kZWxlbWVudC5jc3MoJ3RvcCcsIGFuY2hvclB0KTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuX3NldEJyZWFrUG9pbnRzKG5ld0NvbnRhaW5lckhlaWdodCwgZnVuY3Rpb24oKSB7XHJcbiAgICAgIGlmIChjYiAmJiB0eXBlb2YgY2IgPT09ICdmdW5jdGlvbicpIHsgY2IoKTsgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZXRzIHRoZSB1cHBlciBhbmQgbG93ZXIgYnJlYWtwb2ludHMgZm9yIHRoZSBlbGVtZW50IHRvIGJlY29tZSBzdGlja3kvdW5zdGlja3kuXHJcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGVsZW1IZWlnaHQgLSBweCB2YWx1ZSBmb3Igc3RpY2t5LiRlbGVtZW50IGhlaWdodCwgY2FsY3VsYXRlZCBieSBgX3NldFNpemVzYC5cclxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYiAtIG9wdGlvbmFsIGNhbGxiYWNrIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCBvbiBjb21wbGV0aW9uLlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX3NldEJyZWFrUG9pbnRzKGVsZW1IZWlnaHQsIGNiKSB7XHJcbiAgICBpZiAoIXRoaXMuY2FuU3RpY2spIHtcclxuICAgICAgaWYgKGNiICYmIHR5cGVvZiBjYiA9PT0gJ2Z1bmN0aW9uJykgeyBjYigpOyB9XHJcbiAgICAgIGVsc2UgeyByZXR1cm4gZmFsc2U7IH1cclxuICAgIH1cclxuICAgIHZhciBtVG9wID0gZW1DYWxjKHRoaXMub3B0aW9ucy5tYXJnaW5Ub3ApLFxyXG4gICAgICAgIG1CdG0gPSBlbUNhbGModGhpcy5vcHRpb25zLm1hcmdpbkJvdHRvbSksXHJcbiAgICAgICAgdG9wUG9pbnQgPSB0aGlzLnBvaW50cyA/IHRoaXMucG9pbnRzWzBdIDogdGhpcy4kYW5jaG9yLm9mZnNldCgpLnRvcCxcclxuICAgICAgICBib3R0b21Qb2ludCA9IHRoaXMucG9pbnRzID8gdGhpcy5wb2ludHNbMV0gOiB0b3BQb2ludCArIHRoaXMuYW5jaG9ySGVpZ2h0LFxyXG4gICAgICAgIC8vIHRvcFBvaW50ID0gdGhpcy4kYW5jaG9yLm9mZnNldCgpLnRvcCB8fCB0aGlzLnBvaW50c1swXSxcclxuICAgICAgICAvLyBib3R0b21Qb2ludCA9IHRvcFBvaW50ICsgdGhpcy5hbmNob3JIZWlnaHQgfHwgdGhpcy5wb2ludHNbMV0sXHJcbiAgICAgICAgd2luSGVpZ2h0ID0gd2luZG93LmlubmVySGVpZ2h0O1xyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMuc3RpY2tUbyA9PT0gJ3RvcCcpIHtcclxuICAgICAgdG9wUG9pbnQgLT0gbVRvcDtcclxuICAgICAgYm90dG9tUG9pbnQgLT0gKGVsZW1IZWlnaHQgKyBtVG9wKTtcclxuICAgIH0gZWxzZSBpZiAodGhpcy5vcHRpb25zLnN0aWNrVG8gPT09ICdib3R0b20nKSB7XHJcbiAgICAgIHRvcFBvaW50IC09ICh3aW5IZWlnaHQgLSAoZWxlbUhlaWdodCArIG1CdG0pKTtcclxuICAgICAgYm90dG9tUG9pbnQgLT0gKHdpbkhlaWdodCAtIG1CdG0pO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgLy90aGlzIHdvdWxkIGJlIHRoZSBzdGlja1RvOiBib3RoIG9wdGlvbi4uLiB0cmlja3lcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLnRvcFBvaW50ID0gdG9wUG9pbnQ7XHJcbiAgICB0aGlzLmJvdHRvbVBvaW50ID0gYm90dG9tUG9pbnQ7XHJcblxyXG4gICAgaWYgKGNiICYmIHR5cGVvZiBjYiA9PT0gJ2Z1bmN0aW9uJykgeyBjYigpOyB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZXN0cm95cyB0aGUgY3VycmVudCBzdGlja3kgZWxlbWVudC5cclxuICAgKiBSZXNldHMgdGhlIGVsZW1lbnQgdG8gdGhlIHRvcCBwb3NpdGlvbiBmaXJzdC5cclxuICAgKiBSZW1vdmVzIGV2ZW50IGxpc3RlbmVycywgSlMtYWRkZWQgY3NzIHByb3BlcnRpZXMgYW5kIGNsYXNzZXMsIGFuZCB1bndyYXBzIHRoZSAkZWxlbWVudCBpZiB0aGUgSlMgYWRkZWQgdGhlICRjb250YWluZXIuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgZGVzdHJveSgpIHtcclxuICAgIHRoaXMuX3JlbW92ZVN0aWNreSh0cnVlKTtcclxuXHJcbiAgICB0aGlzLiRlbGVtZW50LnJlbW92ZUNsYXNzKGAke3RoaXMub3B0aW9ucy5zdGlja3lDbGFzc30gaXMtYW5jaG9yZWQgaXMtYXQtdG9wYClcclxuICAgICAgICAgICAgICAgICAuY3NzKHtcclxuICAgICAgICAgICAgICAgICAgIGhlaWdodDogJycsXHJcbiAgICAgICAgICAgICAgICAgICB0b3A6ICcnLFxyXG4gICAgICAgICAgICAgICAgICAgYm90dG9tOiAnJyxcclxuICAgICAgICAgICAgICAgICAgICdtYXgtd2lkdGgnOiAnJ1xyXG4gICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICAgICAgLm9mZigncmVzaXplbWUuemYudHJpZ2dlcicpO1xyXG4gICAgaWYgKHRoaXMuJGFuY2hvciAmJiB0aGlzLiRhbmNob3IubGVuZ3RoKSB7XHJcbiAgICAgIHRoaXMuJGFuY2hvci5vZmYoJ2NoYW5nZS56Zi5zdGlja3knKTtcclxuICAgIH1cclxuICAgICQod2luZG93KS5vZmYodGhpcy5zY3JvbGxMaXN0ZW5lcik7XHJcblxyXG4gICAgaWYgKHRoaXMud2FzV3JhcHBlZCkge1xyXG4gICAgICB0aGlzLiRlbGVtZW50LnVud3JhcCgpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy4kY29udGFpbmVyLnJlbW92ZUNsYXNzKHRoaXMub3B0aW9ucy5jb250YWluZXJDbGFzcylcclxuICAgICAgICAgICAgICAgICAgICAgLmNzcyh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgaGVpZ2h0OiAnJ1xyXG4gICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIEZvdW5kYXRpb24udW5yZWdpc3RlclBsdWdpbih0aGlzKTtcclxuICB9XHJcbn1cclxuXHJcblN0aWNreS5kZWZhdWx0cyA9IHtcclxuICAvKipcclxuICAgKiBDdXN0b21pemFibGUgY29udGFpbmVyIHRlbXBsYXRlLiBBZGQgeW91ciBvd24gY2xhc3NlcyBmb3Igc3R5bGluZyBhbmQgc2l6aW5nLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnJmx0O2RpdiBkYXRhLXN0aWNreS1jb250YWluZXIgY2xhc3M9XCJzbWFsbC02IGNvbHVtbnNcIiZndDsmbHQ7L2RpdiZndDsnXHJcbiAgICovXHJcbiAgY29udGFpbmVyOiAnPGRpdiBkYXRhLXN0aWNreS1jb250YWluZXI+PC9kaXY+JyxcclxuICAvKipcclxuICAgKiBMb2NhdGlvbiBpbiB0aGUgdmlldyB0aGUgZWxlbWVudCBzdGlja3MgdG8uXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICd0b3AnXHJcbiAgICovXHJcbiAgc3RpY2tUbzogJ3RvcCcsXHJcbiAgLyoqXHJcbiAgICogSWYgYW5jaG9yZWQgdG8gYSBzaW5nbGUgZWxlbWVudCwgdGhlIGlkIG9mIHRoYXQgZWxlbWVudC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ2V4YW1wbGVJZCdcclxuICAgKi9cclxuICBhbmNob3I6ICcnLFxyXG4gIC8qKlxyXG4gICAqIElmIHVzaW5nIG1vcmUgdGhhbiBvbmUgZWxlbWVudCBhcyBhbmNob3IgcG9pbnRzLCB0aGUgaWQgb2YgdGhlIHRvcCBhbmNob3IuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICdleGFtcGxlSWQ6dG9wJ1xyXG4gICAqL1xyXG4gIHRvcEFuY2hvcjogJycsXHJcbiAgLyoqXHJcbiAgICogSWYgdXNpbmcgbW9yZSB0aGFuIG9uZSBlbGVtZW50IGFzIGFuY2hvciBwb2ludHMsIHRoZSBpZCBvZiB0aGUgYm90dG9tIGFuY2hvci5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ2V4YW1wbGVJZDpib3R0b20nXHJcbiAgICovXHJcbiAgYnRtQW5jaG9yOiAnJyxcclxuICAvKipcclxuICAgKiBNYXJnaW4sIGluIGBlbWAncyB0byBhcHBseSB0byB0aGUgdG9wIG9mIHRoZSBlbGVtZW50IHdoZW4gaXQgYmVjb21lcyBzdGlja3kuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDFcclxuICAgKi9cclxuICBtYXJnaW5Ub3A6IDEsXHJcbiAgLyoqXHJcbiAgICogTWFyZ2luLCBpbiBgZW1gJ3MgdG8gYXBwbHkgdG8gdGhlIGJvdHRvbSBvZiB0aGUgZWxlbWVudCB3aGVuIGl0IGJlY29tZXMgc3RpY2t5LlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAxXHJcbiAgICovXHJcbiAgbWFyZ2luQm90dG9tOiAxLFxyXG4gIC8qKlxyXG4gICAqIEJyZWFrcG9pbnQgc3RyaW5nIHRoYXQgaXMgdGhlIG1pbmltdW0gc2NyZWVuIHNpemUgYW4gZWxlbWVudCBzaG91bGQgYmVjb21lIHN0aWNreS5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ21lZGl1bSdcclxuICAgKi9cclxuICBzdGlja3lPbjogJ21lZGl1bScsXHJcbiAgLyoqXHJcbiAgICogQ2xhc3MgYXBwbGllZCB0byBzdGlja3kgZWxlbWVudCwgYW5kIHJlbW92ZWQgb24gZGVzdHJ1Y3Rpb24uIEZvdW5kYXRpb24gZGVmYXVsdHMgdG8gYHN0aWNreWAuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICdzdGlja3knXHJcbiAgICovXHJcbiAgc3RpY2t5Q2xhc3M6ICdzdGlja3knLFxyXG4gIC8qKlxyXG4gICAqIENsYXNzIGFwcGxpZWQgdG8gc3RpY2t5IGNvbnRhaW5lci4gRm91bmRhdGlvbiBkZWZhdWx0cyB0byBgc3RpY2t5LWNvbnRhaW5lcmAuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICdzdGlja3ktY29udGFpbmVyJ1xyXG4gICAqL1xyXG4gIGNvbnRhaW5lckNsYXNzOiAnc3RpY2t5LWNvbnRhaW5lcicsXHJcbiAgLyoqXHJcbiAgICogTnVtYmVyIG9mIHNjcm9sbCBldmVudHMgYmV0d2VlbiB0aGUgcGx1Z2luJ3MgcmVjYWxjdWxhdGluZyBzdGlja3kgcG9pbnRzLiBTZXR0aW5nIGl0IHRvIGAwYCB3aWxsIGNhdXNlIGl0IHRvIHJlY2FsYyBldmVyeSBzY3JvbGwgZXZlbnQsIHNldHRpbmcgaXQgdG8gYC0xYCB3aWxsIHByZXZlbnQgcmVjYWxjIG9uIHNjcm9sbC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgNTBcclxuICAgKi9cclxuICBjaGVja0V2ZXJ5OiAtMVxyXG59O1xyXG5cclxuLyoqXHJcbiAqIEhlbHBlciBmdW5jdGlvbiB0byBjYWxjdWxhdGUgZW0gdmFsdWVzXHJcbiAqIEBwYXJhbSBOdW1iZXIge2VtfSAtIG51bWJlciBvZiBlbSdzIHRvIGNhbGN1bGF0ZSBpbnRvIHBpeGVsc1xyXG4gKi9cclxuZnVuY3Rpb24gZW1DYWxjKGVtKSB7XHJcbiAgcmV0dXJuIHBhcnNlSW50KHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGRvY3VtZW50LmJvZHksIG51bGwpLmZvbnRTaXplLCAxMCkgKiBlbTtcclxufVxyXG5cclxuLy8gV2luZG93IGV4cG9ydHNcclxuRm91bmRhdGlvbi5wbHVnaW4oU3RpY2t5LCAnU3RpY2t5Jyk7XHJcblxyXG59KGpRdWVyeSk7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbiFmdW5jdGlvbigkKSB7XHJcblxyXG4vKipcclxuICogVGFicyBtb2R1bGUuXHJcbiAqIEBtb2R1bGUgZm91bmRhdGlvbi50YWJzXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwua2V5Ym9hcmRcclxuICogQHJlcXVpcmVzIGZvdW5kYXRpb24udXRpbC50aW1lckFuZEltYWdlTG9hZGVyIGlmIHRhYnMgY29udGFpbiBpbWFnZXNcclxuICovXHJcblxyXG5jbGFzcyBUYWJzIHtcclxuICAvKipcclxuICAgKiBDcmVhdGVzIGEgbmV3IGluc3RhbmNlIG9mIHRhYnMuXHJcbiAgICogQGNsYXNzXHJcbiAgICogQGZpcmVzIFRhYnMjaW5pdFxyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSBlbGVtZW50IC0galF1ZXJ5IG9iamVjdCB0byBtYWtlIGludG8gdGFicy5cclxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyAtIE92ZXJyaWRlcyB0byB0aGUgZGVmYXVsdCBwbHVnaW4gc2V0dGluZ3MuXHJcbiAgICovXHJcbiAgY29uc3RydWN0b3IoZWxlbWVudCwgb3B0aW9ucykge1xyXG4gICAgdGhpcy4kZWxlbWVudCA9IGVsZW1lbnQ7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgVGFicy5kZWZhdWx0cywgdGhpcy4kZWxlbWVudC5kYXRhKCksIG9wdGlvbnMpO1xyXG5cclxuICAgIHRoaXMuX2luaXQoKTtcclxuICAgIEZvdW5kYXRpb24ucmVnaXN0ZXJQbHVnaW4odGhpcywgJ1RhYnMnKTtcclxuICAgIEZvdW5kYXRpb24uS2V5Ym9hcmQucmVnaXN0ZXIoJ1RhYnMnLCB7XHJcbiAgICAgICdFTlRFUic6ICdvcGVuJyxcclxuICAgICAgJ1NQQUNFJzogJ29wZW4nLFxyXG4gICAgICAnQVJST1dfUklHSFQnOiAnbmV4dCcsXHJcbiAgICAgICdBUlJPV19VUCc6ICdwcmV2aW91cycsXHJcbiAgICAgICdBUlJPV19ET1dOJzogJ25leHQnLFxyXG4gICAgICAnQVJST1dfTEVGVCc6ICdwcmV2aW91cydcclxuICAgICAgLy8gJ1RBQic6ICduZXh0JyxcclxuICAgICAgLy8gJ1NISUZUX1RBQic6ICdwcmV2aW91cydcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbGl6ZXMgdGhlIHRhYnMgYnkgc2hvd2luZyBhbmQgZm9jdXNpbmcgKGlmIGF1dG9Gb2N1cz10cnVlKSB0aGUgcHJlc2V0IGFjdGl2ZSB0YWIuXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfaW5pdCgpIHtcclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcblxyXG4gICAgdGhpcy4kZWxlbWVudC5hdHRyKHsncm9sZSc6ICd0YWJsaXN0J30pO1xyXG4gICAgdGhpcy4kdGFiVGl0bGVzID0gdGhpcy4kZWxlbWVudC5maW5kKGAuJHt0aGlzLm9wdGlvbnMubGlua0NsYXNzfWApO1xyXG4gICAgdGhpcy4kdGFiQ29udGVudCA9ICQoYFtkYXRhLXRhYnMtY29udGVudD1cIiR7dGhpcy4kZWxlbWVudFswXS5pZH1cIl1gKTtcclxuXHJcbiAgICB0aGlzLiR0YWJUaXRsZXMuZWFjaChmdW5jdGlvbigpe1xyXG4gICAgICB2YXIgJGVsZW0gPSAkKHRoaXMpLFxyXG4gICAgICAgICAgJGxpbmsgPSAkZWxlbS5maW5kKCdhJyksXHJcbiAgICAgICAgICBpc0FjdGl2ZSA9ICRlbGVtLmhhc0NsYXNzKGAke190aGlzLm9wdGlvbnMubGlua0FjdGl2ZUNsYXNzfWApLFxyXG4gICAgICAgICAgaGFzaCA9ICRsaW5rWzBdLmhhc2guc2xpY2UoMSksXHJcbiAgICAgICAgICBsaW5rSWQgPSAkbGlua1swXS5pZCA/ICRsaW5rWzBdLmlkIDogYCR7aGFzaH0tbGFiZWxgLFxyXG4gICAgICAgICAgJHRhYkNvbnRlbnQgPSAkKGAjJHtoYXNofWApO1xyXG5cclxuICAgICAgJGVsZW0uYXR0cih7J3JvbGUnOiAncHJlc2VudGF0aW9uJ30pO1xyXG5cclxuICAgICAgJGxpbmsuYXR0cih7XHJcbiAgICAgICAgJ3JvbGUnOiAndGFiJyxcclxuICAgICAgICAnYXJpYS1jb250cm9scyc6IGhhc2gsXHJcbiAgICAgICAgJ2FyaWEtc2VsZWN0ZWQnOiBpc0FjdGl2ZSxcclxuICAgICAgICAnaWQnOiBsaW5rSWRcclxuICAgICAgfSk7XHJcblxyXG4gICAgICAkdGFiQ29udGVudC5hdHRyKHtcclxuICAgICAgICAncm9sZSc6ICd0YWJwYW5lbCcsXHJcbiAgICAgICAgJ2FyaWEtaGlkZGVuJzogIWlzQWN0aXZlLFxyXG4gICAgICAgICdhcmlhLWxhYmVsbGVkYnknOiBsaW5rSWRcclxuICAgICAgfSk7XHJcblxyXG4gICAgICBpZihpc0FjdGl2ZSAmJiBfdGhpcy5vcHRpb25zLmF1dG9Gb2N1cyl7XHJcbiAgICAgICAgJCh3aW5kb3cpLmxvYWQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAkKCdodG1sLCBib2R5JykuYW5pbWF0ZSh7IHNjcm9sbFRvcDogJGVsZW0ub2Zmc2V0KCkudG9wIH0sIF90aGlzLm9wdGlvbnMuZGVlcExpbmtTbXVkZ2VEZWxheSwgKCkgPT4ge1xyXG4gICAgICAgICAgICAkbGluay5mb2N1cygpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vdXNlIGJyb3dzZXIgdG8gb3BlbiBhIHRhYiwgaWYgaXQgZXhpc3RzIGluIHRoaXMgdGFic2V0XHJcbiAgICAgIGlmIChfdGhpcy5vcHRpb25zLmRlZXBMaW5rKSB7XHJcbiAgICAgICAgdmFyIGFuY2hvciA9IHdpbmRvdy5sb2NhdGlvbi5oYXNoO1xyXG4gICAgICAgIC8vbmVlZCBhIGhhc2ggYW5kIGEgcmVsZXZhbnQgYW5jaG9yIGluIHRoaXMgdGFic2V0XHJcbiAgICAgICAgaWYoYW5jaG9yLmxlbmd0aCkge1xyXG4gICAgICAgICAgdmFyICRsaW5rID0gJGVsZW0uZmluZCgnW2hyZWY9XCInK2FuY2hvcisnXCJdJyk7XHJcbiAgICAgICAgICBpZiAoJGxpbmsubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIF90aGlzLnNlbGVjdFRhYigkKGFuY2hvcikpO1xyXG5cclxuICAgICAgICAgICAgLy9yb2xsIHVwIGEgbGl0dGxlIHRvIHNob3cgdGhlIHRpdGxlc1xyXG4gICAgICAgICAgICBpZiAoX3RoaXMub3B0aW9ucy5kZWVwTGlua1NtdWRnZSkge1xyXG4gICAgICAgICAgICAgICQod2luZG93KS5sb2FkKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIG9mZnNldCA9ICRlbGVtLm9mZnNldCgpO1xyXG4gICAgICAgICAgICAgICAgJCgnaHRtbCwgYm9keScpLmFuaW1hdGUoeyBzY3JvbGxUb3A6IG9mZnNldC50b3AgfSwgX3RoaXMub3B0aW9ucy5kZWVwTGlua1NtdWRnZURlbGF5KTtcclxuICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICAgKiBGaXJlcyB3aGVuIHRoZSB6cGx1Z2luIGhhcyBkZWVwbGlua2VkIGF0IHBhZ2Vsb2FkXHJcbiAgICAgICAgICAgICAgKiBAZXZlbnQgVGFicyNkZWVwbGlua1xyXG4gICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgICAkZWxlbS50cmlnZ2VyKCdkZWVwbGluay56Zi50YWJzJywgWyRsaW5rLCAkKGFuY2hvcildKTtcclxuICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICBpZih0aGlzLm9wdGlvbnMubWF0Y2hIZWlnaHQpIHtcclxuICAgICAgdmFyICRpbWFnZXMgPSB0aGlzLiR0YWJDb250ZW50LmZpbmQoJ2ltZycpO1xyXG5cclxuICAgICAgaWYgKCRpbWFnZXMubGVuZ3RoKSB7XHJcbiAgICAgICAgRm91bmRhdGlvbi5vbkltYWdlc0xvYWRlZCgkaW1hZ2VzLCB0aGlzLl9zZXRIZWlnaHQuYmluZCh0aGlzKSk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy5fc2V0SGVpZ2h0KCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICB0aGlzLl9ldmVudHMoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMgZXZlbnQgaGFuZGxlcnMgZm9yIGl0ZW1zIHdpdGhpbiB0aGUgdGFicy5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9ldmVudHMoKSB7XHJcbiAgICB0aGlzLl9hZGRLZXlIYW5kbGVyKCk7XHJcbiAgICB0aGlzLl9hZGRDbGlja0hhbmRsZXIoKTtcclxuICAgIHRoaXMuX3NldEhlaWdodE1xSGFuZGxlciA9IG51bGw7XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5tYXRjaEhlaWdodCkge1xyXG4gICAgICB0aGlzLl9zZXRIZWlnaHRNcUhhbmRsZXIgPSB0aGlzLl9zZXRIZWlnaHQuYmluZCh0aGlzKTtcclxuXHJcbiAgICAgICQod2luZG93KS5vbignY2hhbmdlZC56Zi5tZWRpYXF1ZXJ5JywgdGhpcy5fc2V0SGVpZ2h0TXFIYW5kbGVyKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMgY2xpY2sgaGFuZGxlcnMgZm9yIGl0ZW1zIHdpdGhpbiB0aGUgdGFicy5cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9hZGRDbGlja0hhbmRsZXIoKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG5cclxuICAgIHRoaXMuJGVsZW1lbnRcclxuICAgICAgLm9mZignY2xpY2suemYudGFicycpXHJcbiAgICAgIC5vbignY2xpY2suemYudGFicycsIGAuJHt0aGlzLm9wdGlvbnMubGlua0NsYXNzfWAsIGZ1bmN0aW9uKGUpe1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgIF90aGlzLl9oYW5kbGVUYWJDaGFuZ2UoJCh0aGlzKSk7XHJcbiAgICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBrZXlib2FyZCBldmVudCBoYW5kbGVycyBmb3IgaXRlbXMgd2l0aGluIHRoZSB0YWJzLlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2FkZEtleUhhbmRsZXIoKSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG5cclxuICAgIHRoaXMuJHRhYlRpdGxlcy5vZmYoJ2tleWRvd24uemYudGFicycpLm9uKCdrZXlkb3duLnpmLnRhYnMnLCBmdW5jdGlvbihlKXtcclxuICAgICAgaWYgKGUud2hpY2ggPT09IDkpIHJldHVybjtcclxuXHJcblxyXG4gICAgICB2YXIgJGVsZW1lbnQgPSAkKHRoaXMpLFxyXG4gICAgICAgICRlbGVtZW50cyA9ICRlbGVtZW50LnBhcmVudCgndWwnKS5jaGlsZHJlbignbGknKSxcclxuICAgICAgICAkcHJldkVsZW1lbnQsXHJcbiAgICAgICAgJG5leHRFbGVtZW50O1xyXG5cclxuICAgICAgJGVsZW1lbnRzLmVhY2goZnVuY3Rpb24oaSkge1xyXG4gICAgICAgIGlmICgkKHRoaXMpLmlzKCRlbGVtZW50KSkge1xyXG4gICAgICAgICAgaWYgKF90aGlzLm9wdGlvbnMud3JhcE9uS2V5cykge1xyXG4gICAgICAgICAgICAkcHJldkVsZW1lbnQgPSBpID09PSAwID8gJGVsZW1lbnRzLmxhc3QoKSA6ICRlbGVtZW50cy5lcShpLTEpO1xyXG4gICAgICAgICAgICAkbmV4dEVsZW1lbnQgPSBpID09PSAkZWxlbWVudHMubGVuZ3RoIC0xID8gJGVsZW1lbnRzLmZpcnN0KCkgOiAkZWxlbWVudHMuZXEoaSsxKTtcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICRwcmV2RWxlbWVudCA9ICRlbGVtZW50cy5lcShNYXRoLm1heCgwLCBpLTEpKTtcclxuICAgICAgICAgICAgJG5leHRFbGVtZW50ID0gJGVsZW1lbnRzLmVxKE1hdGgubWluKGkrMSwgJGVsZW1lbnRzLmxlbmd0aC0xKSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIC8vIGhhbmRsZSBrZXlib2FyZCBldmVudCB3aXRoIGtleWJvYXJkIHV0aWxcclxuICAgICAgRm91bmRhdGlvbi5LZXlib2FyZC5oYW5kbGVLZXkoZSwgJ1RhYnMnLCB7XHJcbiAgICAgICAgb3BlbjogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAkZWxlbWVudC5maW5kKCdbcm9sZT1cInRhYlwiXScpLmZvY3VzKCk7XHJcbiAgICAgICAgICBfdGhpcy5faGFuZGxlVGFiQ2hhbmdlKCRlbGVtZW50KTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHByZXZpb3VzOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICRwcmV2RWxlbWVudC5maW5kKCdbcm9sZT1cInRhYlwiXScpLmZvY3VzKCk7XHJcbiAgICAgICAgICBfdGhpcy5faGFuZGxlVGFiQ2hhbmdlKCRwcmV2RWxlbWVudCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBuZXh0OiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICRuZXh0RWxlbWVudC5maW5kKCdbcm9sZT1cInRhYlwiXScpLmZvY3VzKCk7XHJcbiAgICAgICAgICBfdGhpcy5faGFuZGxlVGFiQ2hhbmdlKCRuZXh0RWxlbWVudCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBoYW5kbGVkOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogT3BlbnMgdGhlIHRhYiBgJHRhcmdldENvbnRlbnRgIGRlZmluZWQgYnkgYCR0YXJnZXRgLiBDb2xsYXBzZXMgYWN0aXZlIHRhYi5cclxuICAgKiBAcGFyYW0ge2pRdWVyeX0gJHRhcmdldCAtIFRhYiB0byBvcGVuLlxyXG4gICAqIEBmaXJlcyBUYWJzI2NoYW5nZVxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIF9oYW5kbGVUYWJDaGFuZ2UoJHRhcmdldCkge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2hlY2sgZm9yIGFjdGl2ZSBjbGFzcyBvbiB0YXJnZXQuIENvbGxhcHNlIGlmIGV4aXN0cy5cclxuICAgICAqL1xyXG4gICAgaWYgKCR0YXJnZXQuaGFzQ2xhc3MoYCR7dGhpcy5vcHRpb25zLmxpbmtBY3RpdmVDbGFzc31gKSkge1xyXG4gICAgICAgIGlmKHRoaXMub3B0aW9ucy5hY3RpdmVDb2xsYXBzZSkge1xyXG4gICAgICAgICAgICB0aGlzLl9jb2xsYXBzZVRhYigkdGFyZ2V0KTtcclxuXHJcbiAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICogRmlyZXMgd2hlbiB0aGUgenBsdWdpbiBoYXMgc3VjY2Vzc2Z1bGx5IGNvbGxhcHNlZCB0YWJzLlxyXG4gICAgICAgICAgICAqIEBldmVudCBUYWJzI2NvbGxhcHNlXHJcbiAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcignY29sbGFwc2UuemYudGFicycsIFskdGFyZ2V0XSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgJG9sZFRhYiA9IHRoaXMuJGVsZW1lbnQuXHJcbiAgICAgICAgICBmaW5kKGAuJHt0aGlzLm9wdGlvbnMubGlua0NsYXNzfS4ke3RoaXMub3B0aW9ucy5saW5rQWN0aXZlQ2xhc3N9YCksXHJcbiAgICAgICAgICAkdGFiTGluayA9ICR0YXJnZXQuZmluZCgnW3JvbGU9XCJ0YWJcIl0nKSxcclxuICAgICAgICAgIGhhc2ggPSAkdGFiTGlua1swXS5oYXNoLFxyXG4gICAgICAgICAgJHRhcmdldENvbnRlbnQgPSB0aGlzLiR0YWJDb250ZW50LmZpbmQoaGFzaCk7XHJcblxyXG4gICAgLy9jbG9zZSBvbGQgdGFiXHJcbiAgICB0aGlzLl9jb2xsYXBzZVRhYigkb2xkVGFiKTtcclxuXHJcbiAgICAvL29wZW4gbmV3IHRhYlxyXG4gICAgdGhpcy5fb3BlblRhYigkdGFyZ2V0KTtcclxuXHJcbiAgICAvL2VpdGhlciByZXBsYWNlIG9yIHVwZGF0ZSBicm93c2VyIGhpc3RvcnlcclxuICAgIGlmICh0aGlzLm9wdGlvbnMuZGVlcExpbmspIHtcclxuICAgICAgdmFyIGFuY2hvciA9ICR0YXJnZXQuZmluZCgnYScpLmF0dHIoJ2hyZWYnKTtcclxuXHJcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMudXBkYXRlSGlzdG9yeSkge1xyXG4gICAgICAgIGhpc3RvcnkucHVzaFN0YXRlKHt9LCAnJywgYW5jaG9yKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBoaXN0b3J5LnJlcGxhY2VTdGF0ZSh7fSwgJycsIGFuY2hvcik7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEZpcmVzIHdoZW4gdGhlIHBsdWdpbiBoYXMgc3VjY2Vzc2Z1bGx5IGNoYW5nZWQgdGFicy5cclxuICAgICAqIEBldmVudCBUYWJzI2NoYW5nZVxyXG4gICAgICovXHJcbiAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ2NoYW5nZS56Zi50YWJzJywgWyR0YXJnZXQsICR0YXJnZXRDb250ZW50XSk7XHJcblxyXG4gICAgLy9maXJlIHRvIGNoaWxkcmVuIGEgbXV0YXRpb24gZXZlbnRcclxuICAgICR0YXJnZXRDb250ZW50LmZpbmQoXCJbZGF0YS1tdXRhdGVdXCIpLnRyaWdnZXIoXCJtdXRhdGVtZS56Zi50cmlnZ2VyXCIpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogT3BlbnMgdGhlIHRhYiBgJHRhcmdldENvbnRlbnRgIGRlZmluZWQgYnkgYCR0YXJnZXRgLlxyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSAkdGFyZ2V0IC0gVGFiIHRvIE9wZW4uXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgX29wZW5UYWIoJHRhcmdldCkge1xyXG4gICAgICB2YXIgJHRhYkxpbmsgPSAkdGFyZ2V0LmZpbmQoJ1tyb2xlPVwidGFiXCJdJyksXHJcbiAgICAgICAgICBoYXNoID0gJHRhYkxpbmtbMF0uaGFzaCxcclxuICAgICAgICAgICR0YXJnZXRDb250ZW50ID0gdGhpcy4kdGFiQ29udGVudC5maW5kKGhhc2gpO1xyXG5cclxuICAgICAgJHRhcmdldC5hZGRDbGFzcyhgJHt0aGlzLm9wdGlvbnMubGlua0FjdGl2ZUNsYXNzfWApO1xyXG5cclxuICAgICAgJHRhYkxpbmsuYXR0cih7J2FyaWEtc2VsZWN0ZWQnOiAndHJ1ZSd9KTtcclxuXHJcbiAgICAgICR0YXJnZXRDb250ZW50XHJcbiAgICAgICAgLmFkZENsYXNzKGAke3RoaXMub3B0aW9ucy5wYW5lbEFjdGl2ZUNsYXNzfWApXHJcbiAgICAgICAgLmF0dHIoeydhcmlhLWhpZGRlbic6ICdmYWxzZSd9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENvbGxhcHNlcyBgJHRhcmdldENvbnRlbnRgIGRlZmluZWQgYnkgYCR0YXJnZXRgLlxyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSAkdGFyZ2V0IC0gVGFiIHRvIE9wZW4uXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgX2NvbGxhcHNlVGFiKCR0YXJnZXQpIHtcclxuICAgIHZhciAkdGFyZ2V0X2FuY2hvciA9ICR0YXJnZXRcclxuICAgICAgLnJlbW92ZUNsYXNzKGAke3RoaXMub3B0aW9ucy5saW5rQWN0aXZlQ2xhc3N9YClcclxuICAgICAgLmZpbmQoJ1tyb2xlPVwidGFiXCJdJylcclxuICAgICAgLmF0dHIoeyAnYXJpYS1zZWxlY3RlZCc6ICdmYWxzZScgfSk7XHJcblxyXG4gICAgJChgIyR7JHRhcmdldF9hbmNob3IuYXR0cignYXJpYS1jb250cm9scycpfWApXHJcbiAgICAgIC5yZW1vdmVDbGFzcyhgJHt0aGlzLm9wdGlvbnMucGFuZWxBY3RpdmVDbGFzc31gKVxyXG4gICAgICAuYXR0cih7ICdhcmlhLWhpZGRlbic6ICd0cnVlJyB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFB1YmxpYyBtZXRob2QgZm9yIHNlbGVjdGluZyBhIGNvbnRlbnQgcGFuZSB0byBkaXNwbGF5LlxyXG4gICAqIEBwYXJhbSB7alF1ZXJ5IHwgU3RyaW5nfSBlbGVtIC0galF1ZXJ5IG9iamVjdCBvciBzdHJpbmcgb2YgdGhlIGlkIG9mIHRoZSBwYW5lIHRvIGRpc3BsYXkuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgc2VsZWN0VGFiKGVsZW0pIHtcclxuICAgIHZhciBpZFN0cjtcclxuXHJcbiAgICBpZiAodHlwZW9mIGVsZW0gPT09ICdvYmplY3QnKSB7XHJcbiAgICAgIGlkU3RyID0gZWxlbVswXS5pZDtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGlkU3RyID0gZWxlbTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoaWRTdHIuaW5kZXhPZignIycpIDwgMCkge1xyXG4gICAgICBpZFN0ciA9IGAjJHtpZFN0cn1gO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciAkdGFyZ2V0ID0gdGhpcy4kdGFiVGl0bGVzLmZpbmQoYFtocmVmPVwiJHtpZFN0cn1cIl1gKS5wYXJlbnQoYC4ke3RoaXMub3B0aW9ucy5saW5rQ2xhc3N9YCk7XHJcblxyXG4gICAgdGhpcy5faGFuZGxlVGFiQ2hhbmdlKCR0YXJnZXQpO1xyXG4gIH07XHJcbiAgLyoqXHJcbiAgICogU2V0cyB0aGUgaGVpZ2h0IG9mIGVhY2ggcGFuZWwgdG8gdGhlIGhlaWdodCBvZiB0aGUgdGFsbGVzdCBwYW5lbC5cclxuICAgKiBJZiBlbmFibGVkIGluIG9wdGlvbnMsIGdldHMgY2FsbGVkIG9uIG1lZGlhIHF1ZXJ5IGNoYW5nZS5cclxuICAgKiBJZiBsb2FkaW5nIGNvbnRlbnQgdmlhIGV4dGVybmFsIHNvdXJjZSwgY2FuIGJlIGNhbGxlZCBkaXJlY3RseSBvciB3aXRoIF9yZWZsb3cuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfc2V0SGVpZ2h0KCkge1xyXG4gICAgdmFyIG1heCA9IDA7XHJcbiAgICB0aGlzLiR0YWJDb250ZW50XHJcbiAgICAgIC5maW5kKGAuJHt0aGlzLm9wdGlvbnMucGFuZWxDbGFzc31gKVxyXG4gICAgICAuY3NzKCdoZWlnaHQnLCAnJylcclxuICAgICAgLmVhY2goZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdmFyIHBhbmVsID0gJCh0aGlzKSxcclxuICAgICAgICAgICAgaXNBY3RpdmUgPSBwYW5lbC5oYXNDbGFzcyhgJHt0aGlzLm9wdGlvbnMucGFuZWxBY3RpdmVDbGFzc31gKTtcclxuXHJcbiAgICAgICAgaWYgKCFpc0FjdGl2ZSkge1xyXG4gICAgICAgICAgcGFuZWwuY3NzKHsndmlzaWJpbGl0eSc6ICdoaWRkZW4nLCAnZGlzcGxheSc6ICdibG9jayd9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciB0ZW1wID0gdGhpcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHQ7XHJcblxyXG4gICAgICAgIGlmICghaXNBY3RpdmUpIHtcclxuICAgICAgICAgIHBhbmVsLmNzcyh7XHJcbiAgICAgICAgICAgICd2aXNpYmlsaXR5JzogJycsXHJcbiAgICAgICAgICAgICdkaXNwbGF5JzogJydcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbWF4ID0gdGVtcCA+IG1heCA/IHRlbXAgOiBtYXg7XHJcbiAgICAgIH0pXHJcbiAgICAgIC5jc3MoJ2hlaWdodCcsIGAke21heH1weGApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVzdHJveXMgYW4gaW5zdGFuY2Ugb2YgYW4gdGFicy5cclxuICAgKiBAZmlyZXMgVGFicyNkZXN0cm95ZWRcclxuICAgKi9cclxuICBkZXN0cm95KCkge1xyXG4gICAgdGhpcy4kZWxlbWVudFxyXG4gICAgICAuZmluZChgLiR7dGhpcy5vcHRpb25zLmxpbmtDbGFzc31gKVxyXG4gICAgICAub2ZmKCcuemYudGFicycpLmhpZGUoKS5lbmQoKVxyXG4gICAgICAuZmluZChgLiR7dGhpcy5vcHRpb25zLnBhbmVsQ2xhc3N9YClcclxuICAgICAgLmhpZGUoKTtcclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLm1hdGNoSGVpZ2h0KSB7XHJcbiAgICAgIGlmICh0aGlzLl9zZXRIZWlnaHRNcUhhbmRsZXIgIT0gbnVsbCkge1xyXG4gICAgICAgICAkKHdpbmRvdykub2ZmKCdjaGFuZ2VkLnpmLm1lZGlhcXVlcnknLCB0aGlzLl9zZXRIZWlnaHRNcUhhbmRsZXIpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgRm91bmRhdGlvbi51bnJlZ2lzdGVyUGx1Z2luKHRoaXMpO1xyXG4gIH1cclxufVxyXG5cclxuVGFicy5kZWZhdWx0cyA9IHtcclxuICAvKipcclxuICAgKiBBbGxvd3MgdGhlIHdpbmRvdyB0byBzY3JvbGwgdG8gY29udGVudCBvZiBwYW5lIHNwZWNpZmllZCBieSBoYXNoIGFuY2hvclxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIGRlZXBMaW5rOiBmYWxzZSxcclxuXHJcbiAgLyoqXHJcbiAgICogQWRqdXN0IHRoZSBkZWVwIGxpbmsgc2Nyb2xsIHRvIG1ha2Ugc3VyZSB0aGUgdG9wIG9mIHRoZSB0YWIgcGFuZWwgaXMgdmlzaWJsZVxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIGRlZXBMaW5rU211ZGdlOiBmYWxzZSxcclxuXHJcbiAgLyoqXHJcbiAgICogQW5pbWF0aW9uIHRpbWUgKG1zKSBmb3IgdGhlIGRlZXAgbGluayBhZGp1c3RtZW50XHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDMwMFxyXG4gICAqL1xyXG4gIGRlZXBMaW5rU211ZGdlRGVsYXk6IDMwMCxcclxuXHJcbiAgLyoqXHJcbiAgICogVXBkYXRlIHRoZSBicm93c2VyIGhpc3Rvcnkgd2l0aCB0aGUgb3BlbiB0YWJcclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICB1cGRhdGVIaXN0b3J5OiBmYWxzZSxcclxuXHJcbiAgLyoqXHJcbiAgICogQWxsb3dzIHRoZSB3aW5kb3cgdG8gc2Nyb2xsIHRvIGNvbnRlbnQgb2YgYWN0aXZlIHBhbmUgb24gbG9hZCBpZiBzZXQgdG8gdHJ1ZS5cclxuICAgKiBOb3QgcmVjb21tZW5kZWQgaWYgbW9yZSB0aGFuIG9uZSB0YWIgcGFuZWwgcGVyIHBhZ2UuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgYXV0b0ZvY3VzOiBmYWxzZSxcclxuXHJcbiAgLyoqXHJcbiAgICogQWxsb3dzIGtleWJvYXJkIGlucHV0IHRvICd3cmFwJyBhcm91bmQgdGhlIHRhYiBsaW5rcy5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgdHJ1ZVxyXG4gICAqL1xyXG4gIHdyYXBPbktleXM6IHRydWUsXHJcblxyXG4gIC8qKlxyXG4gICAqIEFsbG93cyB0aGUgdGFiIGNvbnRlbnQgcGFuZXMgdG8gbWF0Y2ggaGVpZ2h0cyBpZiBzZXQgdG8gdHJ1ZS5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgZmFsc2VcclxuICAgKi9cclxuICBtYXRjaEhlaWdodDogZmFsc2UsXHJcblxyXG4gIC8qKlxyXG4gICAqIEFsbG93cyBhY3RpdmUgdGFicyB0byBjb2xsYXBzZSB3aGVuIGNsaWNrZWQuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgYWN0aXZlQ29sbGFwc2U6IGZhbHNlLFxyXG5cclxuICAvKipcclxuICAgKiBDbGFzcyBhcHBsaWVkIHRvIGBsaWAncyBpbiB0YWIgbGluayBsaXN0LlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAndGFicy10aXRsZSdcclxuICAgKi9cclxuICBsaW5rQ2xhc3M6ICd0YWJzLXRpdGxlJyxcclxuXHJcbiAgLyoqXHJcbiAgICogQ2xhc3MgYXBwbGllZCB0byB0aGUgYWN0aXZlIGBsaWAgaW4gdGFiIGxpbmsgbGlzdC5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgJ2lzLWFjdGl2ZSdcclxuICAgKi9cclxuICBsaW5rQWN0aXZlQ2xhc3M6ICdpcy1hY3RpdmUnLFxyXG5cclxuICAvKipcclxuICAgKiBDbGFzcyBhcHBsaWVkIHRvIHRoZSBjb250ZW50IGNvbnRhaW5lcnMuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICd0YWJzLXBhbmVsJ1xyXG4gICAqL1xyXG4gIHBhbmVsQ2xhc3M6ICd0YWJzLXBhbmVsJyxcclxuXHJcbiAgLyoqXHJcbiAgICogQ2xhc3MgYXBwbGllZCB0byB0aGUgYWN0aXZlIGNvbnRlbnQgY29udGFpbmVyLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnaXMtYWN0aXZlJ1xyXG4gICAqL1xyXG4gIHBhbmVsQWN0aXZlQ2xhc3M6ICdpcy1hY3RpdmUnXHJcbn07XHJcblxyXG4vLyBXaW5kb3cgZXhwb3J0c1xyXG5Gb3VuZGF0aW9uLnBsdWdpbihUYWJzLCAnVGFicycpO1xyXG5cclxufShqUXVlcnkpO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG4hZnVuY3Rpb24oJCkge1xyXG5cclxuLyoqXHJcbiAqIFRvZ2dsZXIgbW9kdWxlLlxyXG4gKiBAbW9kdWxlIGZvdW5kYXRpb24udG9nZ2xlclxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLm1vdGlvblxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLnRyaWdnZXJzXHJcbiAqL1xyXG5cclxuY2xhc3MgVG9nZ2xlciB7XHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlcyBhIG5ldyBpbnN0YW5jZSBvZiBUb2dnbGVyLlxyXG4gICAqIEBjbGFzc1xyXG4gICAqIEBmaXJlcyBUb2dnbGVyI2luaXRcclxuICAgKiBAcGFyYW0ge09iamVjdH0gZWxlbWVudCAtIGpRdWVyeSBvYmplY3QgdG8gYWRkIHRoZSB0cmlnZ2VyIHRvLlxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIC0gT3ZlcnJpZGVzIHRvIHRoZSBkZWZhdWx0IHBsdWdpbiBzZXR0aW5ncy5cclxuICAgKi9cclxuICBjb25zdHJ1Y3RvcihlbGVtZW50LCBvcHRpb25zKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50ID0gZWxlbWVudDtcclxuICAgIHRoaXMub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBUb2dnbGVyLmRlZmF1bHRzLCBlbGVtZW50LmRhdGEoKSwgb3B0aW9ucyk7XHJcbiAgICB0aGlzLmNsYXNzTmFtZSA9ICcnO1xyXG5cclxuICAgIHRoaXMuX2luaXQoKTtcclxuICAgIHRoaXMuX2V2ZW50cygpO1xyXG5cclxuICAgIEZvdW5kYXRpb24ucmVnaXN0ZXJQbHVnaW4odGhpcywgJ1RvZ2dsZXInKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEluaXRpYWxpemVzIHRoZSBUb2dnbGVyIHBsdWdpbiBieSBwYXJzaW5nIHRoZSB0b2dnbGUgY2xhc3MgZnJvbSBkYXRhLXRvZ2dsZXIsIG9yIGFuaW1hdGlvbiBjbGFzc2VzIGZyb20gZGF0YS1hbmltYXRlLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2luaXQoKSB7XHJcbiAgICB2YXIgaW5wdXQ7XHJcbiAgICAvLyBQYXJzZSBhbmltYXRpb24gY2xhc3NlcyBpZiB0aGV5IHdlcmUgc2V0XHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmFuaW1hdGUpIHtcclxuICAgICAgaW5wdXQgPSB0aGlzLm9wdGlvbnMuYW5pbWF0ZS5zcGxpdCgnICcpO1xyXG5cclxuICAgICAgdGhpcy5hbmltYXRpb25JbiA9IGlucHV0WzBdO1xyXG4gICAgICB0aGlzLmFuaW1hdGlvbk91dCA9IGlucHV0WzFdIHx8IG51bGw7XHJcbiAgICB9XHJcbiAgICAvLyBPdGhlcndpc2UsIHBhcnNlIHRvZ2dsZSBjbGFzc1xyXG4gICAgZWxzZSB7XHJcbiAgICAgIGlucHV0ID0gdGhpcy4kZWxlbWVudC5kYXRhKCd0b2dnbGVyJyk7XHJcbiAgICAgIC8vIEFsbG93IGZvciBhIC4gYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgc3RyaW5nXHJcbiAgICAgIHRoaXMuY2xhc3NOYW1lID0gaW5wdXRbMF0gPT09ICcuJyA/IGlucHV0LnNsaWNlKDEpIDogaW5wdXQ7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gQWRkIEFSSUEgYXR0cmlidXRlcyB0byB0cmlnZ2Vyc1xyXG4gICAgdmFyIGlkID0gdGhpcy4kZWxlbWVudFswXS5pZDtcclxuICAgICQoYFtkYXRhLW9wZW49XCIke2lkfVwiXSwgW2RhdGEtY2xvc2U9XCIke2lkfVwiXSwgW2RhdGEtdG9nZ2xlPVwiJHtpZH1cIl1gKVxyXG4gICAgICAuYXR0cignYXJpYS1jb250cm9scycsIGlkKTtcclxuICAgIC8vIElmIHRoZSB0YXJnZXQgaXMgaGlkZGVuLCBhZGQgYXJpYS1oaWRkZW5cclxuICAgIHRoaXMuJGVsZW1lbnQuYXR0cignYXJpYS1leHBhbmRlZCcsIHRoaXMuJGVsZW1lbnQuaXMoJzpoaWRkZW4nKSA/IGZhbHNlIDogdHJ1ZSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJbml0aWFsaXplcyBldmVudHMgZm9yIHRoZSB0b2dnbGUgdHJpZ2dlci5cclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqL1xyXG4gIF9ldmVudHMoKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50Lm9mZigndG9nZ2xlLnpmLnRyaWdnZXInKS5vbigndG9nZ2xlLnpmLnRyaWdnZXInLCB0aGlzLnRvZ2dsZS5iaW5kKHRoaXMpKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFRvZ2dsZXMgdGhlIHRhcmdldCBjbGFzcyBvbiB0aGUgdGFyZ2V0IGVsZW1lbnQuIEFuIGV2ZW50IGlzIGZpcmVkIGZyb20gdGhlIG9yaWdpbmFsIHRyaWdnZXIgZGVwZW5kaW5nIG9uIGlmIHRoZSByZXN1bHRhbnQgc3RhdGUgd2FzIFwib25cIiBvciBcIm9mZlwiLlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBmaXJlcyBUb2dnbGVyI29uXHJcbiAgICogQGZpcmVzIFRvZ2dsZXIjb2ZmXHJcbiAgICovXHJcbiAgdG9nZ2xlKCkge1xyXG4gICAgdGhpc1sgdGhpcy5vcHRpb25zLmFuaW1hdGUgPyAnX3RvZ2dsZUFuaW1hdGUnIDogJ190b2dnbGVDbGFzcyddKCk7XHJcbiAgfVxyXG5cclxuICBfdG9nZ2xlQ2xhc3MoKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50LnRvZ2dsZUNsYXNzKHRoaXMuY2xhc3NOYW1lKTtcclxuXHJcbiAgICB2YXIgaXNPbiA9IHRoaXMuJGVsZW1lbnQuaGFzQ2xhc3ModGhpcy5jbGFzc05hbWUpO1xyXG4gICAgaWYgKGlzT24pIHtcclxuICAgICAgLyoqXHJcbiAgICAgICAqIEZpcmVzIGlmIHRoZSB0YXJnZXQgZWxlbWVudCBoYXMgdGhlIGNsYXNzIGFmdGVyIGEgdG9nZ2xlLlxyXG4gICAgICAgKiBAZXZlbnQgVG9nZ2xlciNvblxyXG4gICAgICAgKi9cclxuICAgICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdvbi56Zi50b2dnbGVyJyk7XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgLyoqXHJcbiAgICAgICAqIEZpcmVzIGlmIHRoZSB0YXJnZXQgZWxlbWVudCBkb2VzIG5vdCBoYXZlIHRoZSBjbGFzcyBhZnRlciBhIHRvZ2dsZS5cclxuICAgICAgICogQGV2ZW50IFRvZ2dsZXIjb2ZmXHJcbiAgICAgICAqL1xyXG4gICAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ29mZi56Zi50b2dnbGVyJyk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5fdXBkYXRlQVJJQShpc09uKTtcclxuICAgIHRoaXMuJGVsZW1lbnQuZmluZCgnW2RhdGEtbXV0YXRlXScpLnRyaWdnZXIoJ211dGF0ZW1lLnpmLnRyaWdnZXInKTtcclxuICB9XHJcblxyXG4gIF90b2dnbGVBbmltYXRlKCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuXHJcbiAgICBpZiAodGhpcy4kZWxlbWVudC5pcygnOmhpZGRlbicpKSB7XHJcbiAgICAgIEZvdW5kYXRpb24uTW90aW9uLmFuaW1hdGVJbih0aGlzLiRlbGVtZW50LCB0aGlzLmFuaW1hdGlvbkluLCBmdW5jdGlvbigpIHtcclxuICAgICAgICBfdGhpcy5fdXBkYXRlQVJJQSh0cnVlKTtcclxuICAgICAgICB0aGlzLnRyaWdnZXIoJ29uLnpmLnRvZ2dsZXInKTtcclxuICAgICAgICB0aGlzLmZpbmQoJ1tkYXRhLW11dGF0ZV0nKS50cmlnZ2VyKCdtdXRhdGVtZS56Zi50cmlnZ2VyJyk7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgIEZvdW5kYXRpb24uTW90aW9uLmFuaW1hdGVPdXQodGhpcy4kZWxlbWVudCwgdGhpcy5hbmltYXRpb25PdXQsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIF90aGlzLl91cGRhdGVBUklBKGZhbHNlKTtcclxuICAgICAgICB0aGlzLnRyaWdnZXIoJ29mZi56Zi50b2dnbGVyJyk7XHJcbiAgICAgICAgdGhpcy5maW5kKCdbZGF0YS1tdXRhdGVdJykudHJpZ2dlcignbXV0YXRlbWUuemYudHJpZ2dlcicpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIF91cGRhdGVBUklBKGlzT24pIHtcclxuICAgIHRoaXMuJGVsZW1lbnQuYXR0cignYXJpYS1leHBhbmRlZCcsIGlzT24gPyB0cnVlIDogZmFsc2UpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVzdHJveXMgdGhlIGluc3RhbmNlIG9mIFRvZ2dsZXIgb24gdGhlIGVsZW1lbnQuXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgZGVzdHJveSgpIHtcclxuICAgIHRoaXMuJGVsZW1lbnQub2ZmKCcuemYudG9nZ2xlcicpO1xyXG4gICAgRm91bmRhdGlvbi51bnJlZ2lzdGVyUGx1Z2luKHRoaXMpO1xyXG4gIH1cclxufVxyXG5cclxuVG9nZ2xlci5kZWZhdWx0cyA9IHtcclxuICAvKipcclxuICAgKiBUZWxscyB0aGUgcGx1Z2luIGlmIHRoZSBlbGVtZW50IHNob3VsZCBhbmltYXRlZCB3aGVuIHRvZ2dsZWQuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgYW5pbWF0ZTogZmFsc2VcclxufTtcclxuXHJcbi8vIFdpbmRvdyBleHBvcnRzXHJcbkZvdW5kYXRpb24ucGx1Z2luKFRvZ2dsZXIsICdUb2dnbGVyJyk7XHJcblxyXG59KGpRdWVyeSk7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbiFmdW5jdGlvbigkKSB7XHJcblxyXG4vKipcclxuICogVG9vbHRpcCBtb2R1bGUuXHJcbiAqIEBtb2R1bGUgZm91bmRhdGlvbi50b29sdGlwXHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwuYm94XHJcbiAqIEByZXF1aXJlcyBmb3VuZGF0aW9uLnV0aWwubWVkaWFRdWVyeVxyXG4gKiBAcmVxdWlyZXMgZm91bmRhdGlvbi51dGlsLnRyaWdnZXJzXHJcbiAqL1xyXG5cclxuY2xhc3MgVG9vbHRpcCB7XHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlcyBhIG5ldyBpbnN0YW5jZSBvZiBhIFRvb2x0aXAuXHJcbiAgICogQGNsYXNzXHJcbiAgICogQGZpcmVzIFRvb2x0aXAjaW5pdFxyXG4gICAqIEBwYXJhbSB7alF1ZXJ5fSBlbGVtZW50IC0galF1ZXJ5IG9iamVjdCB0byBhdHRhY2ggYSB0b29sdGlwIHRvLlxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIC0gb2JqZWN0IHRvIGV4dGVuZCB0aGUgZGVmYXVsdCBjb25maWd1cmF0aW9uLlxyXG4gICAqL1xyXG4gIGNvbnN0cnVjdG9yKGVsZW1lbnQsIG9wdGlvbnMpIHtcclxuICAgIHRoaXMuJGVsZW1lbnQgPSBlbGVtZW50O1xyXG4gICAgdGhpcy5vcHRpb25zID0gJC5leHRlbmQoe30sIFRvb2x0aXAuZGVmYXVsdHMsIHRoaXMuJGVsZW1lbnQuZGF0YSgpLCBvcHRpb25zKTtcclxuXHJcbiAgICB0aGlzLmlzQWN0aXZlID0gZmFsc2U7XHJcbiAgICB0aGlzLmlzQ2xpY2sgPSBmYWxzZTtcclxuICAgIHRoaXMuX2luaXQoKTtcclxuXHJcbiAgICBGb3VuZGF0aW9uLnJlZ2lzdGVyUGx1Z2luKHRoaXMsICdUb29sdGlwJyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJbml0aWFsaXplcyB0aGUgdG9vbHRpcCBieSBzZXR0aW5nIHRoZSBjcmVhdGluZyB0aGUgdGlwIGVsZW1lbnQsIGFkZGluZyBpdCdzIHRleHQsIHNldHRpbmcgcHJpdmF0ZSB2YXJpYWJsZXMgYW5kIHNldHRpbmcgYXR0cmlidXRlcyBvbiB0aGUgYW5jaG9yLlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2luaXQoKSB7XHJcbiAgICB2YXIgZWxlbUlkID0gdGhpcy4kZWxlbWVudC5hdHRyKCdhcmlhLWRlc2NyaWJlZGJ5JykgfHwgRm91bmRhdGlvbi5HZXRZb0RpZ2l0cyg2LCAndG9vbHRpcCcpO1xyXG5cclxuICAgIHRoaXMub3B0aW9ucy5wb3NpdGlvbkNsYXNzID0gdGhpcy5vcHRpb25zLnBvc2l0aW9uQ2xhc3MgfHwgdGhpcy5fZ2V0UG9zaXRpb25DbGFzcyh0aGlzLiRlbGVtZW50KTtcclxuICAgIHRoaXMub3B0aW9ucy50aXBUZXh0ID0gdGhpcy5vcHRpb25zLnRpcFRleHQgfHwgdGhpcy4kZWxlbWVudC5hdHRyKCd0aXRsZScpO1xyXG4gICAgdGhpcy50ZW1wbGF0ZSA9IHRoaXMub3B0aW9ucy50ZW1wbGF0ZSA/ICQodGhpcy5vcHRpb25zLnRlbXBsYXRlKSA6IHRoaXMuX2J1aWxkVGVtcGxhdGUoZWxlbUlkKTtcclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmFsbG93SHRtbCkge1xyXG4gICAgICB0aGlzLnRlbXBsYXRlLmFwcGVuZFRvKGRvY3VtZW50LmJvZHkpXHJcbiAgICAgICAgLmh0bWwodGhpcy5vcHRpb25zLnRpcFRleHQpXHJcbiAgICAgICAgLmhpZGUoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMudGVtcGxhdGUuYXBwZW5kVG8oZG9jdW1lbnQuYm9keSlcclxuICAgICAgICAudGV4dCh0aGlzLm9wdGlvbnMudGlwVGV4dClcclxuICAgICAgICAuaGlkZSgpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuJGVsZW1lbnQuYXR0cih7XHJcbiAgICAgICd0aXRsZSc6ICcnLFxyXG4gICAgICAnYXJpYS1kZXNjcmliZWRieSc6IGVsZW1JZCxcclxuICAgICAgJ2RhdGEteWV0aS1ib3gnOiBlbGVtSWQsXHJcbiAgICAgICdkYXRhLXRvZ2dsZSc6IGVsZW1JZCxcclxuICAgICAgJ2RhdGEtcmVzaXplJzogZWxlbUlkXHJcbiAgICB9KS5hZGRDbGFzcyh0aGlzLm9wdGlvbnMudHJpZ2dlckNsYXNzKTtcclxuXHJcbiAgICAvL2hlbHBlciB2YXJpYWJsZXMgdG8gdHJhY2sgbW92ZW1lbnQgb24gY29sbGlzaW9uc1xyXG4gICAgdGhpcy51c2VkUG9zaXRpb25zID0gW107XHJcbiAgICB0aGlzLmNvdW50ZXIgPSA0O1xyXG4gICAgdGhpcy5jbGFzc0NoYW5nZWQgPSBmYWxzZTtcclxuXHJcbiAgICB0aGlzLl9ldmVudHMoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdyYWJzIHRoZSBjdXJyZW50IHBvc2l0aW9uaW5nIGNsYXNzLCBpZiBwcmVzZW50LCBhbmQgcmV0dXJucyB0aGUgdmFsdWUgb3IgYW4gZW1wdHkgc3RyaW5nLlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2dldFBvc2l0aW9uQ2xhc3MoZWxlbWVudCkge1xyXG4gICAgaWYgKCFlbGVtZW50KSB7IHJldHVybiAnJzsgfVxyXG4gICAgLy8gdmFyIHBvc2l0aW9uID0gZWxlbWVudC5hdHRyKCdjbGFzcycpLm1hdGNoKC90b3B8bGVmdHxyaWdodC9nKTtcclxuICAgIHZhciBwb3NpdGlvbiA9IGVsZW1lbnRbMF0uY2xhc3NOYW1lLm1hdGNoKC9cXGIodG9wfGxlZnR8cmlnaHQpXFxiL2cpO1xyXG4gICAgICAgIHBvc2l0aW9uID0gcG9zaXRpb24gPyBwb3NpdGlvblswXSA6ICcnO1xyXG4gICAgcmV0dXJuIHBvc2l0aW9uO1xyXG4gIH07XHJcbiAgLyoqXHJcbiAgICogYnVpbGRzIHRoZSB0b29sdGlwIGVsZW1lbnQsIGFkZHMgYXR0cmlidXRlcywgYW5kIHJldHVybnMgdGhlIHRlbXBsYXRlLlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX2J1aWxkVGVtcGxhdGUoaWQpIHtcclxuICAgIHZhciB0ZW1wbGF0ZUNsYXNzZXMgPSAoYCR7dGhpcy5vcHRpb25zLnRvb2x0aXBDbGFzc30gJHt0aGlzLm9wdGlvbnMucG9zaXRpb25DbGFzc30gJHt0aGlzLm9wdGlvbnMudGVtcGxhdGVDbGFzc2VzfWApLnRyaW0oKTtcclxuICAgIHZhciAkdGVtcGxhdGUgPSAgJCgnPGRpdj48L2Rpdj4nKS5hZGRDbGFzcyh0ZW1wbGF0ZUNsYXNzZXMpLmF0dHIoe1xyXG4gICAgICAncm9sZSc6ICd0b29sdGlwJyxcclxuICAgICAgJ2FyaWEtaGlkZGVuJzogdHJ1ZSxcclxuICAgICAgJ2RhdGEtaXMtYWN0aXZlJzogZmFsc2UsXHJcbiAgICAgICdkYXRhLWlzLWZvY3VzJzogZmFsc2UsXHJcbiAgICAgICdpZCc6IGlkXHJcbiAgICB9KTtcclxuICAgIHJldHVybiAkdGVtcGxhdGU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBGdW5jdGlvbiB0aGF0IGdldHMgY2FsbGVkIGlmIGEgY29sbGlzaW9uIGV2ZW50IGlzIGRldGVjdGVkLlxyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBwb3NpdGlvbiAtIHBvc2l0aW9uaW5nIGNsYXNzIHRvIHRyeVxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX3JlcG9zaXRpb24ocG9zaXRpb24pIHtcclxuICAgIHRoaXMudXNlZFBvc2l0aW9ucy5wdXNoKHBvc2l0aW9uID8gcG9zaXRpb24gOiAnYm90dG9tJyk7XHJcblxyXG4gICAgLy9kZWZhdWx0LCB0cnkgc3dpdGNoaW5nIHRvIG9wcG9zaXRlIHNpZGVcclxuICAgIGlmICghcG9zaXRpb24gJiYgKHRoaXMudXNlZFBvc2l0aW9ucy5pbmRleE9mKCd0b3AnKSA8IDApKSB7XHJcbiAgICAgIHRoaXMudGVtcGxhdGUuYWRkQ2xhc3MoJ3RvcCcpO1xyXG4gICAgfSBlbHNlIGlmIChwb3NpdGlvbiA9PT0gJ3RvcCcgJiYgKHRoaXMudXNlZFBvc2l0aW9ucy5pbmRleE9mKCdib3R0b20nKSA8IDApKSB7XHJcbiAgICAgIHRoaXMudGVtcGxhdGUucmVtb3ZlQ2xhc3MocG9zaXRpb24pO1xyXG4gICAgfSBlbHNlIGlmIChwb3NpdGlvbiA9PT0gJ2xlZnQnICYmICh0aGlzLnVzZWRQb3NpdGlvbnMuaW5kZXhPZigncmlnaHQnKSA8IDApKSB7XHJcbiAgICAgIHRoaXMudGVtcGxhdGUucmVtb3ZlQ2xhc3MocG9zaXRpb24pXHJcbiAgICAgICAgICAuYWRkQ2xhc3MoJ3JpZ2h0Jyk7XHJcbiAgICB9IGVsc2UgaWYgKHBvc2l0aW9uID09PSAncmlnaHQnICYmICh0aGlzLnVzZWRQb3NpdGlvbnMuaW5kZXhPZignbGVmdCcpIDwgMCkpIHtcclxuICAgICAgdGhpcy50ZW1wbGF0ZS5yZW1vdmVDbGFzcyhwb3NpdGlvbilcclxuICAgICAgICAgIC5hZGRDbGFzcygnbGVmdCcpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vaWYgZGVmYXVsdCBjaGFuZ2UgZGlkbid0IHdvcmssIHRyeSBib3R0b20gb3IgbGVmdCBmaXJzdFxyXG4gICAgZWxzZSBpZiAoIXBvc2l0aW9uICYmICh0aGlzLnVzZWRQb3NpdGlvbnMuaW5kZXhPZigndG9wJykgPiAtMSkgJiYgKHRoaXMudXNlZFBvc2l0aW9ucy5pbmRleE9mKCdsZWZ0JykgPCAwKSkge1xyXG4gICAgICB0aGlzLnRlbXBsYXRlLmFkZENsYXNzKCdsZWZ0Jyk7XHJcbiAgICB9IGVsc2UgaWYgKHBvc2l0aW9uID09PSAndG9wJyAmJiAodGhpcy51c2VkUG9zaXRpb25zLmluZGV4T2YoJ2JvdHRvbScpID4gLTEpICYmICh0aGlzLnVzZWRQb3NpdGlvbnMuaW5kZXhPZignbGVmdCcpIDwgMCkpIHtcclxuICAgICAgdGhpcy50ZW1wbGF0ZS5yZW1vdmVDbGFzcyhwb3NpdGlvbilcclxuICAgICAgICAgIC5hZGRDbGFzcygnbGVmdCcpO1xyXG4gICAgfSBlbHNlIGlmIChwb3NpdGlvbiA9PT0gJ2xlZnQnICYmICh0aGlzLnVzZWRQb3NpdGlvbnMuaW5kZXhPZigncmlnaHQnKSA+IC0xKSAmJiAodGhpcy51c2VkUG9zaXRpb25zLmluZGV4T2YoJ2JvdHRvbScpIDwgMCkpIHtcclxuICAgICAgdGhpcy50ZW1wbGF0ZS5yZW1vdmVDbGFzcyhwb3NpdGlvbik7XHJcbiAgICB9IGVsc2UgaWYgKHBvc2l0aW9uID09PSAncmlnaHQnICYmICh0aGlzLnVzZWRQb3NpdGlvbnMuaW5kZXhPZignbGVmdCcpID4gLTEpICYmICh0aGlzLnVzZWRQb3NpdGlvbnMuaW5kZXhPZignYm90dG9tJykgPCAwKSkge1xyXG4gICAgICB0aGlzLnRlbXBsYXRlLnJlbW92ZUNsYXNzKHBvc2l0aW9uKTtcclxuICAgIH1cclxuICAgIC8vaWYgbm90aGluZyBjbGVhcmVkLCBzZXQgdG8gYm90dG9tXHJcbiAgICBlbHNlIHtcclxuICAgICAgdGhpcy50ZW1wbGF0ZS5yZW1vdmVDbGFzcyhwb3NpdGlvbik7XHJcbiAgICB9XHJcbiAgICB0aGlzLmNsYXNzQ2hhbmdlZCA9IHRydWU7XHJcbiAgICB0aGlzLmNvdW50ZXItLTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIHNldHMgdGhlIHBvc2l0aW9uIGNsYXNzIG9mIGFuIGVsZW1lbnQgYW5kIHJlY3Vyc2l2ZWx5IGNhbGxzIGl0c2VsZiB1bnRpbCB0aGVyZSBhcmUgbm8gbW9yZSBwb3NzaWJsZSBwb3NpdGlvbnMgdG8gYXR0ZW1wdCwgb3IgdGhlIHRvb2x0aXAgZWxlbWVudCBpcyBubyBsb25nZXIgY29sbGlkaW5nLlxyXG4gICAqIGlmIHRoZSB0b29sdGlwIGlzIGxhcmdlciB0aGFuIHRoZSBzY3JlZW4gd2lkdGgsIGRlZmF1bHQgdG8gZnVsbCB3aWR0aCAtIGFueSB1c2VyIHNlbGVjdGVkIG1hcmdpblxyXG4gICAqIEBwcml2YXRlXHJcbiAgICovXHJcbiAgX3NldFBvc2l0aW9uKCkge1xyXG4gICAgdmFyIHBvc2l0aW9uID0gdGhpcy5fZ2V0UG9zaXRpb25DbGFzcyh0aGlzLnRlbXBsYXRlKSxcclxuICAgICAgICAkdGlwRGltcyA9IEZvdW5kYXRpb24uQm94LkdldERpbWVuc2lvbnModGhpcy50ZW1wbGF0ZSksXHJcbiAgICAgICAgJGFuY2hvckRpbXMgPSBGb3VuZGF0aW9uLkJveC5HZXREaW1lbnNpb25zKHRoaXMuJGVsZW1lbnQpLFxyXG4gICAgICAgIGRpcmVjdGlvbiA9IChwb3NpdGlvbiA9PT0gJ2xlZnQnID8gJ2xlZnQnIDogKChwb3NpdGlvbiA9PT0gJ3JpZ2h0JykgPyAnbGVmdCcgOiAndG9wJykpLFxyXG4gICAgICAgIHBhcmFtID0gKGRpcmVjdGlvbiA9PT0gJ3RvcCcpID8gJ2hlaWdodCcgOiAnd2lkdGgnLFxyXG4gICAgICAgIG9mZnNldCA9IChwYXJhbSA9PT0gJ2hlaWdodCcpID8gdGhpcy5vcHRpb25zLnZPZmZzZXQgOiB0aGlzLm9wdGlvbnMuaE9mZnNldCxcclxuICAgICAgICBfdGhpcyA9IHRoaXM7XHJcblxyXG4gICAgaWYgKCgkdGlwRGltcy53aWR0aCA+PSAkdGlwRGltcy53aW5kb3dEaW1zLndpZHRoKSB8fCAoIXRoaXMuY291bnRlciAmJiAhRm91bmRhdGlvbi5Cb3guSW1Ob3RUb3VjaGluZ1lvdSh0aGlzLnRlbXBsYXRlKSkpIHtcclxuICAgICAgdGhpcy50ZW1wbGF0ZS5vZmZzZXQoRm91bmRhdGlvbi5Cb3guR2V0T2Zmc2V0cyh0aGlzLnRlbXBsYXRlLCB0aGlzLiRlbGVtZW50LCAnY2VudGVyIGJvdHRvbScsIHRoaXMub3B0aW9ucy52T2Zmc2V0LCB0aGlzLm9wdGlvbnMuaE9mZnNldCwgdHJ1ZSkpLmNzcyh7XHJcbiAgICAgIC8vIHRoaXMuJGVsZW1lbnQub2Zmc2V0KEZvdW5kYXRpb24uR2V0T2Zmc2V0cyh0aGlzLnRlbXBsYXRlLCB0aGlzLiRlbGVtZW50LCAnY2VudGVyIGJvdHRvbScsIHRoaXMub3B0aW9ucy52T2Zmc2V0LCB0aGlzLm9wdGlvbnMuaE9mZnNldCwgdHJ1ZSkpLmNzcyh7XHJcbiAgICAgICAgJ3dpZHRoJzogJGFuY2hvckRpbXMud2luZG93RGltcy53aWR0aCAtICh0aGlzLm9wdGlvbnMuaE9mZnNldCAqIDIpLFxyXG4gICAgICAgICdoZWlnaHQnOiAnYXV0bydcclxuICAgICAgfSk7XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLnRlbXBsYXRlLm9mZnNldChGb3VuZGF0aW9uLkJveC5HZXRPZmZzZXRzKHRoaXMudGVtcGxhdGUsIHRoaXMuJGVsZW1lbnQsJ2NlbnRlciAnICsgKHBvc2l0aW9uIHx8ICdib3R0b20nKSwgdGhpcy5vcHRpb25zLnZPZmZzZXQsIHRoaXMub3B0aW9ucy5oT2Zmc2V0KSk7XHJcblxyXG4gICAgd2hpbGUoIUZvdW5kYXRpb24uQm94LkltTm90VG91Y2hpbmdZb3UodGhpcy50ZW1wbGF0ZSkgJiYgdGhpcy5jb3VudGVyKSB7XHJcbiAgICAgIHRoaXMuX3JlcG9zaXRpb24ocG9zaXRpb24pO1xyXG4gICAgICB0aGlzLl9zZXRQb3NpdGlvbigpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogcmV2ZWFscyB0aGUgdG9vbHRpcCwgYW5kIGZpcmVzIGFuIGV2ZW50IHRvIGNsb3NlIGFueSBvdGhlciBvcGVuIHRvb2x0aXBzIG9uIHRoZSBwYWdlXHJcbiAgICogQGZpcmVzIFRvb2x0aXAjY2xvc2VtZVxyXG4gICAqIEBmaXJlcyBUb29sdGlwI3Nob3dcclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICBzaG93KCkge1xyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5zaG93T24gIT09ICdhbGwnICYmICFGb3VuZGF0aW9uLk1lZGlhUXVlcnkuaXModGhpcy5vcHRpb25zLnNob3dPbikpIHtcclxuICAgICAgLy8gY29uc29sZS5lcnJvcignVGhlIHNjcmVlbiBpcyB0b28gc21hbGwgdG8gZGlzcGxheSB0aGlzIHRvb2x0aXAnKTtcclxuICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBfdGhpcyA9IHRoaXM7XHJcbiAgICB0aGlzLnRlbXBsYXRlLmNzcygndmlzaWJpbGl0eScsICdoaWRkZW4nKS5zaG93KCk7XHJcbiAgICB0aGlzLl9zZXRQb3NpdGlvbigpO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogRmlyZXMgdG8gY2xvc2UgYWxsIG90aGVyIG9wZW4gdG9vbHRpcHMgb24gdGhlIHBhZ2VcclxuICAgICAqIEBldmVudCBDbG9zZW1lI3Rvb2x0aXBcclxuICAgICAqL1xyXG4gICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdjbG9zZW1lLnpmLnRvb2x0aXAnLCB0aGlzLnRlbXBsYXRlLmF0dHIoJ2lkJykpO1xyXG5cclxuXHJcbiAgICB0aGlzLnRlbXBsYXRlLmF0dHIoe1xyXG4gICAgICAnZGF0YS1pcy1hY3RpdmUnOiB0cnVlLFxyXG4gICAgICAnYXJpYS1oaWRkZW4nOiBmYWxzZVxyXG4gICAgfSk7XHJcbiAgICBfdGhpcy5pc0FjdGl2ZSA9IHRydWU7XHJcbiAgICAvLyBjb25zb2xlLmxvZyh0aGlzLnRlbXBsYXRlKTtcclxuICAgIHRoaXMudGVtcGxhdGUuc3RvcCgpLmhpZGUoKS5jc3MoJ3Zpc2liaWxpdHknLCAnJykuZmFkZUluKHRoaXMub3B0aW9ucy5mYWRlSW5EdXJhdGlvbiwgZnVuY3Rpb24oKSB7XHJcbiAgICAgIC8vbWF5YmUgZG8gc3R1ZmY/XHJcbiAgICB9KTtcclxuICAgIC8qKlxyXG4gICAgICogRmlyZXMgd2hlbiB0aGUgdG9vbHRpcCBpcyBzaG93blxyXG4gICAgICogQGV2ZW50IFRvb2x0aXAjc2hvd1xyXG4gICAgICovXHJcbiAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ3Nob3cuemYudG9vbHRpcCcpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGlkZXMgdGhlIGN1cnJlbnQgdG9vbHRpcCwgYW5kIHJlc2V0cyB0aGUgcG9zaXRpb25pbmcgY2xhc3MgaWYgaXQgd2FzIGNoYW5nZWQgZHVlIHRvIGNvbGxpc2lvblxyXG4gICAqIEBmaXJlcyBUb29sdGlwI2hpZGVcclxuICAgKiBAZnVuY3Rpb25cclxuICAgKi9cclxuICBoaWRlKCkge1xyXG4gICAgLy8gY29uc29sZS5sb2coJ2hpZGluZycsIHRoaXMuJGVsZW1lbnQuZGF0YSgneWV0aS1ib3gnKSk7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG4gICAgdGhpcy50ZW1wbGF0ZS5zdG9wKCkuYXR0cih7XHJcbiAgICAgICdhcmlhLWhpZGRlbic6IHRydWUsXHJcbiAgICAgICdkYXRhLWlzLWFjdGl2ZSc6IGZhbHNlXHJcbiAgICB9KS5mYWRlT3V0KHRoaXMub3B0aW9ucy5mYWRlT3V0RHVyYXRpb24sIGZ1bmN0aW9uKCkge1xyXG4gICAgICBfdGhpcy5pc0FjdGl2ZSA9IGZhbHNlO1xyXG4gICAgICBfdGhpcy5pc0NsaWNrID0gZmFsc2U7XHJcbiAgICAgIGlmIChfdGhpcy5jbGFzc0NoYW5nZWQpIHtcclxuICAgICAgICBfdGhpcy50ZW1wbGF0ZVxyXG4gICAgICAgICAgICAgLnJlbW92ZUNsYXNzKF90aGlzLl9nZXRQb3NpdGlvbkNsYXNzKF90aGlzLnRlbXBsYXRlKSlcclxuICAgICAgICAgICAgIC5hZGRDbGFzcyhfdGhpcy5vcHRpb25zLnBvc2l0aW9uQ2xhc3MpO1xyXG5cclxuICAgICAgIF90aGlzLnVzZWRQb3NpdGlvbnMgPSBbXTtcclxuICAgICAgIF90aGlzLmNvdW50ZXIgPSA0O1xyXG4gICAgICAgX3RoaXMuY2xhc3NDaGFuZ2VkID0gZmFsc2U7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgLyoqXHJcbiAgICAgKiBmaXJlcyB3aGVuIHRoZSB0b29sdGlwIGlzIGhpZGRlblxyXG4gICAgICogQGV2ZW50IFRvb2x0aXAjaGlkZVxyXG4gICAgICovXHJcbiAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ2hpZGUuemYudG9vbHRpcCcpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogYWRkcyBldmVudCBsaXN0ZW5lcnMgZm9yIHRoZSB0b29sdGlwIGFuZCBpdHMgYW5jaG9yXHJcbiAgICogVE9ETyBjb21iaW5lIHNvbWUgb2YgdGhlIGxpc3RlbmVycyBsaWtlIGZvY3VzIGFuZCBtb3VzZWVudGVyLCBldGMuXHJcbiAgICogQHByaXZhdGVcclxuICAgKi9cclxuICBfZXZlbnRzKCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuICAgIHZhciAkdGVtcGxhdGUgPSB0aGlzLnRlbXBsYXRlO1xyXG4gICAgdmFyIGlzRm9jdXMgPSBmYWxzZTtcclxuXHJcbiAgICBpZiAoIXRoaXMub3B0aW9ucy5kaXNhYmxlSG92ZXIpIHtcclxuXHJcbiAgICAgIHRoaXMuJGVsZW1lbnRcclxuICAgICAgLm9uKCdtb3VzZWVudGVyLnpmLnRvb2x0aXAnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgaWYgKCFfdGhpcy5pc0FjdGl2ZSkge1xyXG4gICAgICAgICAgX3RoaXMudGltZW91dCA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIF90aGlzLnNob3coKTtcclxuICAgICAgICAgIH0sIF90aGlzLm9wdGlvbnMuaG92ZXJEZWxheSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KVxyXG4gICAgICAub24oJ21vdXNlbGVhdmUuemYudG9vbHRpcCcsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBjbGVhclRpbWVvdXQoX3RoaXMudGltZW91dCk7XHJcbiAgICAgICAgaWYgKCFpc0ZvY3VzIHx8IChfdGhpcy5pc0NsaWNrICYmICFfdGhpcy5vcHRpb25zLmNsaWNrT3BlbikpIHtcclxuICAgICAgICAgIF90aGlzLmhpZGUoKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMuY2xpY2tPcGVuKSB7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQub24oJ21vdXNlZG93bi56Zi50b29sdGlwJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XHJcbiAgICAgICAgaWYgKF90aGlzLmlzQ2xpY2spIHtcclxuICAgICAgICAgIC8vX3RoaXMuaGlkZSgpO1xyXG4gICAgICAgICAgLy8gX3RoaXMuaXNDbGljayA9IGZhbHNlO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBfdGhpcy5pc0NsaWNrID0gdHJ1ZTtcclxuICAgICAgICAgIGlmICgoX3RoaXMub3B0aW9ucy5kaXNhYmxlSG92ZXIgfHwgIV90aGlzLiRlbGVtZW50LmF0dHIoJ3RhYmluZGV4JykpICYmICFfdGhpcy5pc0FjdGl2ZSkge1xyXG4gICAgICAgICAgICBfdGhpcy5zaG93KCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQub24oJ21vdXNlZG93bi56Zi50b29sdGlwJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XHJcbiAgICAgICAgX3RoaXMuaXNDbGljayA9IHRydWU7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICghdGhpcy5vcHRpb25zLmRpc2FibGVGb3JUb3VjaCkge1xyXG4gICAgICB0aGlzLiRlbGVtZW50XHJcbiAgICAgIC5vbigndGFwLnpmLnRvb2x0aXAgdG91Y2hlbmQuemYudG9vbHRpcCcsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBfdGhpcy5pc0FjdGl2ZSA/IF90aGlzLmhpZGUoKSA6IF90aGlzLnNob3coKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy4kZWxlbWVudC5vbih7XHJcbiAgICAgIC8vICd0b2dnbGUuemYudHJpZ2dlcic6IHRoaXMudG9nZ2xlLmJpbmQodGhpcyksXHJcbiAgICAgIC8vICdjbG9zZS56Zi50cmlnZ2VyJzogdGhpcy5oaWRlLmJpbmQodGhpcylcclxuICAgICAgJ2Nsb3NlLnpmLnRyaWdnZXInOiB0aGlzLmhpZGUuYmluZCh0aGlzKVxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy4kZWxlbWVudFxyXG4gICAgICAub24oJ2ZvY3VzLnpmLnRvb2x0aXAnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgaXNGb2N1cyA9IHRydWU7XHJcbiAgICAgICAgaWYgKF90aGlzLmlzQ2xpY2spIHtcclxuICAgICAgICAgIC8vIElmIHdlJ3JlIG5vdCBzaG93aW5nIG9wZW4gb24gY2xpY2tzLCB3ZSBuZWVkIHRvIHByZXRlbmQgYSBjbGljay1sYXVuY2hlZCBmb2N1cyBpc24ndFxyXG4gICAgICAgICAgLy8gYSByZWFsIGZvY3VzLCBvdGhlcndpc2Ugb24gaG92ZXIgYW5kIGNvbWUgYmFjayB3ZSBnZXQgYmFkIGJlaGF2aW9yXHJcbiAgICAgICAgICBpZighX3RoaXMub3B0aW9ucy5jbGlja09wZW4pIHsgaXNGb2N1cyA9IGZhbHNlOyB9XHJcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIF90aGlzLnNob3coKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pXHJcblxyXG4gICAgICAub24oJ2ZvY3Vzb3V0LnpmLnRvb2x0aXAnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgaXNGb2N1cyA9IGZhbHNlO1xyXG4gICAgICAgIF90aGlzLmlzQ2xpY2sgPSBmYWxzZTtcclxuICAgICAgICBfdGhpcy5oaWRlKCk7XHJcbiAgICAgIH0pXHJcblxyXG4gICAgICAub24oJ3Jlc2l6ZW1lLnpmLnRyaWdnZXInLCBmdW5jdGlvbigpIHtcclxuICAgICAgICBpZiAoX3RoaXMuaXNBY3RpdmUpIHtcclxuICAgICAgICAgIF90aGlzLl9zZXRQb3NpdGlvbigpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBhZGRzIGEgdG9nZ2xlIG1ldGhvZCwgaW4gYWRkaXRpb24gdG8gdGhlIHN0YXRpYyBzaG93KCkgJiBoaWRlKCkgZnVuY3Rpb25zXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICovXHJcbiAgdG9nZ2xlKCkge1xyXG4gICAgaWYgKHRoaXMuaXNBY3RpdmUpIHtcclxuICAgICAgdGhpcy5oaWRlKCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLnNob3coKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlc3Ryb3lzIGFuIGluc3RhbmNlIG9mIHRvb2x0aXAsIHJlbW92ZXMgdGVtcGxhdGUgZWxlbWVudCBmcm9tIHRoZSB2aWV3LlxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqL1xyXG4gIGRlc3Ryb3koKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50LmF0dHIoJ3RpdGxlJywgdGhpcy50ZW1wbGF0ZS50ZXh0KCkpXHJcbiAgICAgICAgICAgICAgICAgLm9mZignLnpmLnRyaWdnZXIgLnpmLnRvb2x0aXAnKVxyXG4gICAgICAgICAgICAgICAgIC5yZW1vdmVDbGFzcygnaGFzLXRpcCB0b3AgcmlnaHQgbGVmdCcpXHJcbiAgICAgICAgICAgICAgICAgLnJlbW92ZUF0dHIoJ2FyaWEtZGVzY3JpYmVkYnkgYXJpYS1oYXNwb3B1cCBkYXRhLWRpc2FibGUtaG92ZXIgZGF0YS1yZXNpemUgZGF0YS10b2dnbGUgZGF0YS10b29sdGlwIGRhdGEteWV0aS1ib3gnKTtcclxuXHJcbiAgICB0aGlzLnRlbXBsYXRlLnJlbW92ZSgpO1xyXG5cclxuICAgIEZvdW5kYXRpb24udW5yZWdpc3RlclBsdWdpbih0aGlzKTtcclxuICB9XHJcbn1cclxuXHJcblRvb2x0aXAuZGVmYXVsdHMgPSB7XHJcbiAgZGlzYWJsZUZvclRvdWNoOiBmYWxzZSxcclxuICAvKipcclxuICAgKiBUaW1lLCBpbiBtcywgYmVmb3JlIGEgdG9vbHRpcCBzaG91bGQgb3BlbiBvbiBob3Zlci5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgMjAwXHJcbiAgICovXHJcbiAgaG92ZXJEZWxheTogMjAwLFxyXG4gIC8qKlxyXG4gICAqIFRpbWUsIGluIG1zLCBhIHRvb2x0aXAgc2hvdWxkIHRha2UgdG8gZmFkZSBpbnRvIHZpZXcuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIDE1MFxyXG4gICAqL1xyXG4gIGZhZGVJbkR1cmF0aW9uOiAxNTAsXHJcbiAgLyoqXHJcbiAgICogVGltZSwgaW4gbXMsIGEgdG9vbHRpcCBzaG91bGQgdGFrZSB0byBmYWRlIG91dCBvZiB2aWV3LlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAxNTBcclxuICAgKi9cclxuICBmYWRlT3V0RHVyYXRpb246IDE1MCxcclxuICAvKipcclxuICAgKiBEaXNhYmxlcyBob3ZlciBldmVudHMgZnJvbSBvcGVuaW5nIHRoZSB0b29sdGlwIGlmIHNldCB0byB0cnVlXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlIGZhbHNlXHJcbiAgICovXHJcbiAgZGlzYWJsZUhvdmVyOiBmYWxzZSxcclxuICAvKipcclxuICAgKiBPcHRpb25hbCBhZGR0aW9uYWwgY2xhc3NlcyB0byBhcHBseSB0byB0aGUgdG9vbHRpcCB0ZW1wbGF0ZSBvbiBpbml0LlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnbXktY29vbC10aXAtY2xhc3MnXHJcbiAgICovXHJcbiAgdGVtcGxhdGVDbGFzc2VzOiAnJyxcclxuICAvKipcclxuICAgKiBOb24tb3B0aW9uYWwgY2xhc3MgYWRkZWQgdG8gdG9vbHRpcCB0ZW1wbGF0ZXMuIEZvdW5kYXRpb24gZGVmYXVsdCBpcyAndG9vbHRpcCcuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICd0b29sdGlwJ1xyXG4gICAqL1xyXG4gIHRvb2x0aXBDbGFzczogJ3Rvb2x0aXAnLFxyXG4gIC8qKlxyXG4gICAqIENsYXNzIGFwcGxpZWQgdG8gdGhlIHRvb2x0aXAgYW5jaG9yIGVsZW1lbnQuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICdoYXMtdGlwJ1xyXG4gICAqL1xyXG4gIHRyaWdnZXJDbGFzczogJ2hhcy10aXAnLFxyXG4gIC8qKlxyXG4gICAqIE1pbmltdW0gYnJlYWtwb2ludCBzaXplIGF0IHdoaWNoIHRvIG9wZW4gdGhlIHRvb2x0aXAuXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICdzbWFsbCdcclxuICAgKi9cclxuICBzaG93T246ICdzbWFsbCcsXHJcbiAgLyoqXHJcbiAgICogQ3VzdG9tIHRlbXBsYXRlIHRvIGJlIHVzZWQgdG8gZ2VuZXJhdGUgbWFya3VwIGZvciB0b29sdGlwLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAnJmx0O2RpdiBjbGFzcz1cInRvb2x0aXBcIiZndDsmbHQ7L2RpdiZndDsnXHJcbiAgICovXHJcbiAgdGVtcGxhdGU6ICcnLFxyXG4gIC8qKlxyXG4gICAqIFRleHQgZGlzcGxheWVkIGluIHRoZSB0b29sdGlwIHRlbXBsYXRlIG9uIG9wZW4uXHJcbiAgICogQG9wdGlvblxyXG4gICAqIEBleGFtcGxlICdTb21lIGNvb2wgc3BhY2UgZmFjdCBoZXJlLidcclxuICAgKi9cclxuICB0aXBUZXh0OiAnJyxcclxuICB0b3VjaENsb3NlVGV4dDogJ1RhcCB0byBjbG9zZS4nLFxyXG4gIC8qKlxyXG4gICAqIEFsbG93cyB0aGUgdG9vbHRpcCB0byByZW1haW4gb3BlbiBpZiB0cmlnZ2VyZWQgd2l0aCBhIGNsaWNrIG9yIHRvdWNoIGV2ZW50LlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSB0cnVlXHJcbiAgICovXHJcbiAgY2xpY2tPcGVuOiB0cnVlLFxyXG4gIC8qKlxyXG4gICAqIEFkZGl0aW9uYWwgcG9zaXRpb25pbmcgY2xhc3Nlcywgc2V0IGJ5IHRoZSBKU1xyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAndG9wJ1xyXG4gICAqL1xyXG4gIHBvc2l0aW9uQ2xhc3M6ICcnLFxyXG4gIC8qKlxyXG4gICAqIERpc3RhbmNlLCBpbiBwaXhlbHMsIHRoZSB0ZW1wbGF0ZSBzaG91bGQgcHVzaCBhd2F5IGZyb20gdGhlIGFuY2hvciBvbiB0aGUgWSBheGlzLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSAxMFxyXG4gICAqL1xyXG4gIHZPZmZzZXQ6IDEwLFxyXG4gIC8qKlxyXG4gICAqIERpc3RhbmNlLCBpbiBwaXhlbHMsIHRoZSB0ZW1wbGF0ZSBzaG91bGQgcHVzaCBhd2F5IGZyb20gdGhlIGFuY2hvciBvbiB0aGUgWCBheGlzLCBpZiBhbGlnbmVkIHRvIGEgc2lkZS5cclxuICAgKiBAb3B0aW9uXHJcbiAgICogQGV4YW1wbGUgMTJcclxuICAgKi9cclxuICBoT2Zmc2V0OiAxMixcclxuICAgIC8qKlxyXG4gICAqIEFsbG93IEhUTUwgaW4gdG9vbHRpcC4gV2FybmluZzogSWYgeW91IGFyZSBsb2FkaW5nIHVzZXItZ2VuZXJhdGVkIGNvbnRlbnQgaW50byB0b29sdGlwcyxcclxuICAgKiBhbGxvd2luZyBIVE1MIG1heSBvcGVuIHlvdXJzZWxmIHVwIHRvIFhTUyBhdHRhY2tzLlxyXG4gICAqIEBvcHRpb25cclxuICAgKiBAZXhhbXBsZSBmYWxzZVxyXG4gICAqL1xyXG4gIGFsbG93SHRtbDogZmFsc2VcclxufTtcclxuXHJcbi8qKlxyXG4gKiBUT0RPIHV0aWxpemUgcmVzaXplIGV2ZW50IHRyaWdnZXJcclxuICovXHJcblxyXG4vLyBXaW5kb3cgZXhwb3J0c1xyXG5Gb3VuZGF0aW9uLnBsdWdpbihUb29sdGlwLCAnVG9vbHRpcCcpO1xyXG5cclxufShqUXVlcnkpO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG4vLyBQb2x5ZmlsbCBmb3IgcmVxdWVzdEFuaW1hdGlvbkZyYW1lXHJcbihmdW5jdGlvbigpIHtcclxuICBpZiAoIURhdGUubm93KVxyXG4gICAgRGF0ZS5ub3cgPSBmdW5jdGlvbigpIHsgcmV0dXJuIG5ldyBEYXRlKCkuZ2V0VGltZSgpOyB9O1xyXG5cclxuICB2YXIgdmVuZG9ycyA9IFsnd2Via2l0JywgJ21veiddO1xyXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdmVuZG9ycy5sZW5ndGggJiYgIXdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWU7ICsraSkge1xyXG4gICAgICB2YXIgdnAgPSB2ZW5kb3JzW2ldO1xyXG4gICAgICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gd2luZG93W3ZwKydSZXF1ZXN0QW5pbWF0aW9uRnJhbWUnXTtcclxuICAgICAgd2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lID0gKHdpbmRvd1t2cCsnQ2FuY2VsQW5pbWF0aW9uRnJhbWUnXVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8fCB3aW5kb3dbdnArJ0NhbmNlbFJlcXVlc3RBbmltYXRpb25GcmFtZSddKTtcclxuICB9XHJcbiAgaWYgKC9pUChhZHxob25lfG9kKS4qT1MgNi8udGVzdCh3aW5kb3cubmF2aWdhdG9yLnVzZXJBZ2VudClcclxuICAgIHx8ICF3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8ICF3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUpIHtcclxuICAgIHZhciBsYXN0VGltZSA9IDA7XHJcbiAgICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcclxuICAgICAgICB2YXIgbm93ID0gRGF0ZS5ub3coKTtcclxuICAgICAgICB2YXIgbmV4dFRpbWUgPSBNYXRoLm1heChsYXN0VGltZSArIDE2LCBub3cpO1xyXG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkgeyBjYWxsYmFjayhsYXN0VGltZSA9IG5leHRUaW1lKTsgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBuZXh0VGltZSAtIG5vdyk7XHJcbiAgICB9O1xyXG4gICAgd2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lID0gY2xlYXJUaW1lb3V0O1xyXG4gIH1cclxufSkoKTtcclxuXHJcbnZhciBpbml0Q2xhc3NlcyAgID0gWydtdWktZW50ZXInLCAnbXVpLWxlYXZlJ107XHJcbnZhciBhY3RpdmVDbGFzc2VzID0gWydtdWktZW50ZXItYWN0aXZlJywgJ211aS1sZWF2ZS1hY3RpdmUnXTtcclxuXHJcbi8vIEZpbmQgdGhlIHJpZ2h0IFwidHJhbnNpdGlvbmVuZFwiIGV2ZW50IGZvciB0aGlzIGJyb3dzZXJcclxudmFyIGVuZEV2ZW50ID0gKGZ1bmN0aW9uKCkge1xyXG4gIHZhciB0cmFuc2l0aW9ucyA9IHtcclxuICAgICd0cmFuc2l0aW9uJzogJ3RyYW5zaXRpb25lbmQnLFxyXG4gICAgJ1dlYmtpdFRyYW5zaXRpb24nOiAnd2Via2l0VHJhbnNpdGlvbkVuZCcsXHJcbiAgICAnTW96VHJhbnNpdGlvbic6ICd0cmFuc2l0aW9uZW5kJyxcclxuICAgICdPVHJhbnNpdGlvbic6ICdvdHJhbnNpdGlvbmVuZCdcclxuICB9XHJcbiAgdmFyIGVsZW0gPSB3aW5kb3cuZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcblxyXG4gIGZvciAodmFyIHQgaW4gdHJhbnNpdGlvbnMpIHtcclxuICAgIGlmICh0eXBlb2YgZWxlbS5zdHlsZVt0XSAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgcmV0dXJuIHRyYW5zaXRpb25zW3RdO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIG51bGw7XHJcbn0pKCk7XHJcblxyXG5mdW5jdGlvbiBhbmltYXRlKGlzSW4sIGVsZW1lbnQsIGFuaW1hdGlvbiwgY2IpIHtcclxuICBlbGVtZW50ID0gJChlbGVtZW50KS5lcSgwKTtcclxuXHJcbiAgaWYgKCFlbGVtZW50Lmxlbmd0aCkgcmV0dXJuO1xyXG5cclxuICBpZiAoZW5kRXZlbnQgPT09IG51bGwpIHtcclxuICAgIGlzSW4gPyBlbGVtZW50LnNob3coKSA6IGVsZW1lbnQuaGlkZSgpO1xyXG4gICAgY2IoKTtcclxuICAgIHJldHVybjtcclxuICB9XHJcblxyXG4gIHZhciBpbml0Q2xhc3MgPSBpc0luID8gaW5pdENsYXNzZXNbMF0gOiBpbml0Q2xhc3Nlc1sxXTtcclxuICB2YXIgYWN0aXZlQ2xhc3MgPSBpc0luID8gYWN0aXZlQ2xhc3Nlc1swXSA6IGFjdGl2ZUNsYXNzZXNbMV07XHJcblxyXG4gIC8vIFNldCB1cCB0aGUgYW5pbWF0aW9uXHJcbiAgcmVzZXQoKTtcclxuICBlbGVtZW50LmFkZENsYXNzKGFuaW1hdGlvbik7XHJcbiAgZWxlbWVudC5jc3MoJ3RyYW5zaXRpb24nLCAnbm9uZScpO1xyXG4gIHJlcXVlc3RBbmltYXRpb25GcmFtZShmdW5jdGlvbigpIHtcclxuICAgIGVsZW1lbnQuYWRkQ2xhc3MoaW5pdENsYXNzKTtcclxuICAgIGlmIChpc0luKSBlbGVtZW50LnNob3coKTtcclxuICB9KTtcclxuXHJcbiAgLy8gU3RhcnQgdGhlIGFuaW1hdGlvblxyXG4gIHJlcXVlc3RBbmltYXRpb25GcmFtZShmdW5jdGlvbigpIHtcclxuICAgIGVsZW1lbnRbMF0ub2Zmc2V0V2lkdGg7XHJcbiAgICBlbGVtZW50LmNzcygndHJhbnNpdGlvbicsICcnKTtcclxuICAgIGVsZW1lbnQuYWRkQ2xhc3MoYWN0aXZlQ2xhc3MpO1xyXG4gIH0pO1xyXG5cclxuICAvLyBDbGVhbiB1cCB0aGUgYW5pbWF0aW9uIHdoZW4gaXQgZmluaXNoZXNcclxuICBlbGVtZW50Lm9uZSgndHJhbnNpdGlvbmVuZCcsIGZpbmlzaCk7XHJcblxyXG4gIC8vIEhpZGVzIHRoZSBlbGVtZW50IChmb3Igb3V0IGFuaW1hdGlvbnMpLCByZXNldHMgdGhlIGVsZW1lbnQsIGFuZCBydW5zIGEgY2FsbGJhY2tcclxuICBmdW5jdGlvbiBmaW5pc2goKSB7XHJcbiAgICBpZiAoIWlzSW4pIGVsZW1lbnQuaGlkZSgpO1xyXG4gICAgcmVzZXQoKTtcclxuICAgIGlmIChjYikgY2IuYXBwbHkoZWxlbWVudCk7XHJcbiAgfVxyXG5cclxuICAvLyBSZXNldHMgdHJhbnNpdGlvbnMgYW5kIHJlbW92ZXMgbW90aW9uLXNwZWNpZmljIGNsYXNzZXNcclxuICBmdW5jdGlvbiByZXNldCgpIHtcclxuICAgIGVsZW1lbnRbMF0uc3R5bGUudHJhbnNpdGlvbkR1cmF0aW9uID0gMDtcclxuICAgIGVsZW1lbnQucmVtb3ZlQ2xhc3MoaW5pdENsYXNzICsgJyAnICsgYWN0aXZlQ2xhc3MgKyAnICcgKyBhbmltYXRpb24pO1xyXG4gIH1cclxufVxyXG5cclxudmFyIE1vdGlvblVJID0ge1xyXG4gIGFuaW1hdGVJbjogZnVuY3Rpb24oZWxlbWVudCwgYW5pbWF0aW9uLCBjYikge1xyXG4gICAgYW5pbWF0ZSh0cnVlLCBlbGVtZW50LCBhbmltYXRpb24sIGNiKTtcclxuICB9LFxyXG5cclxuICBhbmltYXRlT3V0OiBmdW5jdGlvbihlbGVtZW50LCBhbmltYXRpb24sIGNiKSB7XHJcbiAgICBhbmltYXRlKGZhbHNlLCBlbGVtZW50LCBhbmltYXRpb24sIGNiKTtcclxuICB9XHJcbn1cclxuIiwiJChmdW5jdGlvbigpIHtcclxuICAgICQod2luZG93KS5zY3JvbGwoIGZ1bmN0aW9uKCl7XHJcblxyXG5cclxuICAgICAgICAkKCcuaGlkZW1lJykuZWFjaCggZnVuY3Rpb24oaSl7XHJcblxyXG4gICAgICAgICAgICB2YXIgYm90dG9tX29mX29iamVjdCA9ICQodGhpcykucG9zaXRpb24oKS50b3AgKyAkKHRoaXMpLm91dGVySGVpZ2h0KCk7XHJcbiAgICAgICAgICAgIHZhciBib3R0b21fb2Zfd2luZG93ID0gJCh3aW5kb3cpLnNjcm9sbFRvcCgpICsgJCh3aW5kb3cpLmhlaWdodCgpO1xyXG5cclxuICAgICAgICAgICAgLyogQWRqdXN0IHRoZSBcIjIwMFwiIHRvIGVpdGhlciBoYXZlIGEgZGVsYXkgb3IgdGhhdCB0aGUgY29udGVudCBzdGFydHMgZmFkaW5nIGEgYml0IGJlZm9yZSB5b3UgcmVhY2ggaXQgICovXHJcbiAgICAgICAgICAgIGJvdHRvbV9vZl93aW5kb3cgPSBib3R0b21fb2Zfd2luZG93ICsgNTAwO1xyXG5cclxuICAgICAgICAgICAgaWYoIGJvdHRvbV9vZl93aW5kb3cgPiBib3R0b21fb2Zfb2JqZWN0ICl7XHJcblxyXG4gICAgICAgICAgICAgICAgJCh0aGlzKS5hbmltYXRlKHsnb3BhY2l0eSc6JzEnfSw1MDApO1xyXG5cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgIH0pO1xyXG59KTtcclxuXHJcbiQod2luZG93KS5zY3JvbGwoZnVuY3Rpb24oKSB7XHJcblxyXG4gIC8qIGFuaW1hemlvbmUgdG9wIG1lbnUgKi9cclxuICBpZigkKHRoaXMpLnNjcm9sbFRvcCgpPjUwKXtcclxuICAgICAgJChcIiNiYWNrdG90b3BcIikuY3NzKFwib3BhY2l0eVwiLFwiIDFcIik7XHJcbiAgfSBlbHNlIHtcclxuICAgICQoXCIjYmFja3RvdG9wXCIpLmNzcyhcIm9wYWNpdHlcIiwgXCIwXCIpO1xyXG4gIH1cclxuXHJcbiAgfSk7XHJcblxyXG4gLypBemlvbmUgR29Ub3AqL1xyXG4gZnVuY3Rpb24gZ290b190b3AoKSB7XHJcbiAgICQoJ2h0bWwsIGJvZHknKS5hbmltYXRlKHtcclxuICAgICBzY3JvbGxUb3A6IDBcclxuICAgfSwxNTAwKTtcclxuIH1cclxuXHJcbiAvKiBCQUNLIFRPIFRPUCAqL1xyXG4gJChcIiNiYWNrdG90b3AgYVwiKS5jbGljayggZnVuY3Rpb24oKSB7XHJcbiAgIGdvdG9fdG9wKCk7XHJcbiB9KTtcclxuXHJcbi8qUm9sbC1ob3ZlciBpbW1hZ2luaSB3aW5uZXIqL1xuXG4kKGRvY3VtZW50KS5yZWFkeShmdW5jdGlvbigpIHtcbiAgJCgnLnNpbmdsZS1ldmVudCcpLmhvdmVyKFxyXG4gICAgZnVuY3Rpb24oKXtcblxuICAgICAgJCh0aGlzKS5maW5kKCcuY2FwdGlvbicpLmZhZGVJbigzNTApO1xuICAgIH0sXG4gICAgZnVuY3Rpb24oKXtcbiAgICAgICQodGhpcykuZmluZCgnLmNhcHRpb24nKS5mYWRlT3V0KDIwMCk7XG4gICAgfVxuICApO1xufSk7XHJcblxyXG4kKGRvY3VtZW50KS5yZWFkeShmdW5jdGlvbigpIHtcclxuICAkKCcuc2luZ2xlLWV2ZW50NicpLmhvdmVyKFxyXG4gICAgZnVuY3Rpb24oKXtcclxuXHJcbiAgICAgICQodGhpcykuZmluZCgnLmNhcHRpb24nKS5mYWRlSW4oMzUwKTtcclxuICAgIH0sXHJcbiAgICBmdW5jdGlvbigpe1xyXG4gICAgICAkKHRoaXMpLmZpbmQoJy5jYXB0aW9uJykuZmFkZU91dCgyMDApO1xyXG4gICAgfVxyXG4gICk7XHJcbn0pO1xyXG5cclxuXHJcbi8qQ2xhc3NlIG1lbnUgKi9cclxuJCh3aW5kb3cpLnNjcm9sbChmdW5jdGlvbigpIHtcclxuICBpZigkKHRoaXMpLnNjcm9sbFRvcCgpPjEwMCl7XHJcbiAgJChcIi5pcy1zdHVja1wiKS5hZGRDbGFzcyhcInNtYWxsZXJcIik7XHJcbiAgLyokKFwiLmlzLXN0dWNrXCIpLnJlbW92ZUNsYXNzKFwiYmlnZ2VyXCIpOyovXHJcblxyXG5cclxufSBlbHNlIHtcclxuJChcIi5pcy1zdHVja1wiKS5yZW1vdmVDbGFzcyhcInNtYWxsZXJcIik7XHJcbi8qJChcIi50b3AtYmFyXCIpLmFkZENsYXNzKFwiYmlnZ2VyXCIpOyovXHJcblxyXG4gfVxyXG4gIH0pO1xyXG5cclxuXHJcbi8qR3JleSBpbWFnaW5lKi9cclxuJCh3aW5kb3cpLnNjcm9sbChmdW5jdGlvbigpIHtcclxuICBpZigkKHRoaXMpLnNjcm9sbFRvcCgpPjUwMCl7XHJcbiAgJChcIi5vcmJpdC1pbWFnZVwiKS5hZGRDbGFzcyhcImdyZXktb25cIik7XHJcblxyXG59IGVsc2Uge1xyXG4kKFwiaW1nLm9yYml0LWltYWdlXCIpLnJlbW92ZUNsYXNzKFwiZ3JleS1vblwiKTtcclxuXHJcbiB9XHJcbiAgfSk7XHJcbiIsIlxyXG5cclxuIGZ1bmN0aW9uIGluaXRNYXAoKSB7XHJcbiAgIC8vdmFyIG1hcmtlcjtcclxuXHJcblx0IC8vIENyZWF0ZSBhIG5ldyBTdHlsZWRNYXBUeXBlIG9iamVjdCwgcGFzc2luZyBpdCBhbiBhcnJheSBvZiBzdHlsZXMsXHJcblx0IC8vIGFuZCB0aGUgbmFtZSB0byBiZSBkaXNwbGF5ZWQgb24gdGhlIG1hcCB0eXBlIGNvbnRyb2wuXHJcblx0IHZhciBzdHlsZWRNYXBUeXBlID0gbmV3IGdvb2dsZS5tYXBzLlN0eWxlZE1hcFR5cGUoXHJcblxyXG5cdFx0XHRcdCAvKlxyXG4gICAgICAgICB7ZWxlbWVudFR5cGU6ICdnZW9tZXRyeScsIHN0eWxlcnM6IFt7Y29sb3I6ICcjMDAwMDAwJ31dfSxcclxuXHRcdFx0XHQge2VsZW1lbnRUeXBlOiAnbGFiZWxzLnRleHQuZmlsbCcsIHN0eWxlcnM6IFt7Y29sb3I6ICcjNTIzNzM1J31dfSxcclxuXHRcdFx0XHQge2VsZW1lbnRUeXBlOiAnbGFiZWxzLnRleHQuc3Ryb2tlJywgc3R5bGVyczogW3tjb2xvcjogJyNmNWYxZTYnfV19LFxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIFtcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgICBcImZlYXR1cmVUeXBlXCI6IFwiYWRtaW5pc3RyYXRpdmVcIixcclxuICAgICAgICAgICAgICBcImVsZW1lbnRUeXBlXCI6IFwiZ2VvbWV0cnlcIixcclxuICAgICAgICAgICAgICBcInN0eWxlcnNcIjogW1xyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICBcImNvbG9yXCI6IFwiIzgwNDA0MFwiXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBcImZlYXR1cmVUeXBlXCI6IFwiYWRtaW5pc3RyYXRpdmVcIixcclxuICAgICAgICAgICAgICAgIFwiZWxlbWVudFR5cGVcIjogXCJnZW9tZXRyeS5maWxsXCIsXHJcbiAgICAgICAgICAgICAgICBcInN0eWxlcnNcIjogW1xyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJjb2xvclwiOiBcIiMwMDAwNDBcIlxyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBcImZlYXR1cmVUeXBlXCI6IFwiYWRtaW5pc3RyYXRpdmVcIixcclxuICAgICAgICAgICAgICAgIFwiZWxlbWVudFR5cGVcIjogXCJnZW9tZXRyeS5zdHJva2VcIixcclxuICAgICAgICAgICAgICAgIFwic3R5bGVyc1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcImNvbG9yXCI6IFwiIzAwMDA0MFwiXHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIFwiZmVhdHVyZVR5cGVcIjogXCJhZG1pbmlzdHJhdGl2ZS5jb3VudHJ5XCIsXHJcbiAgICAgICAgICAgICAgICBcImVsZW1lbnRUeXBlXCI6IFwiZ2VvbWV0cnkuZmlsbFwiLFxyXG4gICAgICAgICAgICAgICAgXCJzdHlsZXJzXCI6IFtcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwiY29sb3JcIjogXCIjODAwMDAwXCJcclxuICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwidmlzaWJpbGl0eVwiOiBcIm9uXCJcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcImFkbWluaXN0cmF0aXZlLmNvdW50cnlcIixcclxuICAgICAgICAgICAgICAgIFwiZWxlbWVudFR5cGVcIjogXCJnZW9tZXRyeS5zdHJva2VcIixcclxuICAgICAgICAgICAgICAgIFwic3R5bGVyc1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcImNvbG9yXCI6IFwiIzgwMDAwMFwiXHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIFwiZmVhdHVyZVR5cGVcIjogXCJhZG1pbmlzdHJhdGl2ZS5jb3VudHJ5XCIsXHJcbiAgICAgICAgICAgICAgICBcImVsZW1lbnRUeXBlXCI6IFwibGFiZWxzLnRleHRcIixcclxuICAgICAgICAgICAgICAgIFwic3R5bGVyc1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcImNvbG9yXCI6IFwiIzgwODAwMFwiXHJcbiAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcInZpc2liaWxpdHlcIjogXCJzaW1wbGlmaWVkXCJcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcImFkbWluaXN0cmF0aXZlLmxhbmRfcGFyY2VsXCIsXHJcbiAgICAgICAgICAgICAgICBcImVsZW1lbnRUeXBlXCI6IFwiZ2VvbWV0cnkuZmlsbFwiLFxyXG4gICAgICAgICAgICAgICAgXCJzdHlsZXJzXCI6IFtcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwidmlzaWJpbGl0eVwiOiBcIm9uXCJcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcImFkbWluaXN0cmF0aXZlLmxhbmRfcGFyY2VsXCIsXHJcbiAgICAgICAgICAgICAgICBcImVsZW1lbnRUeXBlXCI6IFwiZ2VvbWV0cnkuc3Ryb2tlXCIsXHJcbiAgICAgICAgICAgICAgICBcInN0eWxlcnNcIjogW1xyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJ2aXNpYmlsaXR5XCI6IFwic2ltcGxpZmllZFwiXHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIFwiZmVhdHVyZVR5cGVcIjogXCJhZG1pbmlzdHJhdGl2ZS5sb2NhbGl0eVwiLFxyXG4gICAgICAgICAgICAgICAgXCJzdHlsZXJzXCI6IFtcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwidmlzaWJpbGl0eVwiOiBcIm9mZlwiXHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIFwiZmVhdHVyZVR5cGVcIjogXCJhZG1pbmlzdHJhdGl2ZS5sb2NhbGl0eVwiLFxyXG4gICAgICAgICAgICAgICAgXCJlbGVtZW50VHlwZVwiOiBcImdlb21ldHJ5LmZpbGxcIixcclxuICAgICAgICAgICAgICAgIFwic3R5bGVyc1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcInZpc2liaWxpdHlcIjogXCJvblwiXHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIFwiZmVhdHVyZVR5cGVcIjogXCJhZG1pbmlzdHJhdGl2ZS5uZWlnaGJvcmhvb2RcIixcclxuICAgICAgICAgICAgICAgIFwiZWxlbWVudFR5cGVcIjogXCJnZW9tZXRyeS5maWxsXCIsXHJcbiAgICAgICAgICAgICAgICBcInN0eWxlcnNcIjogW1xyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJ2aXNpYmlsaXR5XCI6IFwic2ltcGxpZmllZFwiXHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIFwiZmVhdHVyZVR5cGVcIjogXCJsYW5kc2NhcGUubWFuX21hZGVcIixcclxuICAgICAgICAgICAgICAgIFwiZWxlbWVudFR5cGVcIjogXCJnZW9tZXRyeS5maWxsXCIsXHJcbiAgICAgICAgICAgICAgICBcInN0eWxlcnNcIjogW1xyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJjb2xvclwiOiBcIiM4MTgyODVcIlxyXG4gICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJzYXR1cmF0aW9uXCI6IDIwXHJcbiAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcImxpZ2h0bmVzc1wiOiA0NVxyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBcImZlYXR1cmVUeXBlXCI6IFwibGFuZHNjYXBlLm1hbl9tYWRlXCIsXHJcbiAgICAgICAgICAgICAgICBcImVsZW1lbnRUeXBlXCI6IFwiZ2VvbWV0cnkuc3Ryb2tlXCIsXHJcbiAgICAgICAgICAgICAgICBcInN0eWxlcnNcIjogW1xyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJjb2xvclwiOiBcIiMwMDAwMDBcIlxyXG4gICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJ2aXNpYmlsaXR5XCI6IFwib25cIlxyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBcImZlYXR1cmVUeXBlXCI6IFwibGFuZHNjYXBlLm1hbl9tYWRlXCIsXHJcbiAgICAgICAgICAgICAgICBcImVsZW1lbnRUeXBlXCI6IFwibGFiZWxzLnRleHQuZmlsbFwiLFxyXG4gICAgICAgICAgICAgICAgXCJzdHlsZXJzXCI6IFtcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwic2F0dXJhdGlvblwiOiA1MFxyXG4gICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJsaWdodG5lc3NcIjogLTQwXHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIFwiZmVhdHVyZVR5cGVcIjogXCJsYW5kc2NhcGUubmF0dXJhbFwiLFxyXG4gICAgICAgICAgICAgICAgXCJlbGVtZW50VHlwZVwiOiBcImdlb21ldHJ5LnN0cm9rZVwiLFxyXG4gICAgICAgICAgICAgICAgXCJzdHlsZXJzXCI6IFtcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwiY29sb3JcIjogXCIjNDA4MDgwXCJcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcImxhbmRzY2FwZS5uYXR1cmFsLmxhbmRjb3ZlclwiLFxyXG4gICAgICAgICAgICAgICAgXCJlbGVtZW50VHlwZVwiOiBcImdlb21ldHJ5LmZpbGxcIixcclxuICAgICAgICAgICAgICAgIFwic3R5bGVyc1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcInNhdHVyYXRpb25cIjogLTIwXHJcbiAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcImxpZ2h0bmVzc1wiOiAxMDBcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcImxhbmRzY2FwZS5uYXR1cmFsLnRlcnJhaW5cIixcclxuICAgICAgICAgICAgICAgIFwiZWxlbWVudFR5cGVcIjogXCJnZW9tZXRyeS5maWxsXCIsXHJcbiAgICAgICAgICAgICAgICBcInN0eWxlcnNcIjogW1xyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJ2aXNpYmlsaXR5XCI6IFwic2ltcGxpZmllZFwiXHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIFwiZmVhdHVyZVR5cGVcIjogXCJwb2kucGFya1wiLFxyXG4gICAgICAgICAgICAgICAgXCJlbGVtZW50VHlwZVwiOiBcImdlb21ldHJ5LmZpbGxcIixcclxuICAgICAgICAgICAgICAgIFwic3R5bGVyc1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcInNhdHVyYXRpb25cIjogMzVcclxuICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwibGlnaHRuZXNzXCI6IDM1XHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIFwiZmVhdHVyZVR5cGVcIjogXCJwb2kucGxhY2Vfb2Zfd29yc2hpcFwiLFxyXG4gICAgICAgICAgICAgICAgXCJlbGVtZW50VHlwZVwiOiBcImdlb21ldHJ5LmZpbGxcIixcclxuICAgICAgICAgICAgICAgIFwic3R5bGVyc1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcImNvbG9yXCI6IFwiIzAwMDAwMFwiXHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIFwiZmVhdHVyZVR5cGVcIjogXCJyb2FkLmFydGVyaWFsXCIsXHJcbiAgICAgICAgICAgICAgICBcImVsZW1lbnRUeXBlXCI6IFwiZ2VvbWV0cnkuZmlsbFwiLFxyXG4gICAgICAgICAgICAgICAgXCJzdHlsZXJzXCI6IFtcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwiY29sb3JcIjogXCIjY2ZiNjNhXCJcclxuICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwic2F0dXJhdGlvblwiOiAxMDBcclxuICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwibGlnaHRuZXNzXCI6IDI1XHJcbiAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcIndlaWdodFwiOiAyLjVcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcInJvYWQuYXJ0ZXJpYWxcIixcclxuICAgICAgICAgICAgICAgIFwiZWxlbWVudFR5cGVcIjogXCJnZW9tZXRyeS5zdHJva2VcIixcclxuICAgICAgICAgICAgICAgIFwic3R5bGVyc1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcImNvbG9yXCI6IFwiI2NmYjYzYVwiXHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIFwiZmVhdHVyZVR5cGVcIjogXCJyb2FkLmhpZ2h3YXlcIixcclxuICAgICAgICAgICAgICAgIFwiZWxlbWVudFR5cGVcIjogXCJnZW9tZXRyeS5maWxsXCIsXHJcbiAgICAgICAgICAgICAgICBcInN0eWxlcnNcIjogW1xyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJjb2xvclwiOiBcIiMzYzk0YzRcIlxyXG4gICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJsaWdodG5lc3NcIjogNDVcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcInJvYWQuaGlnaHdheS5jb250cm9sbGVkX2FjY2Vzc1wiLFxyXG4gICAgICAgICAgICAgICAgXCJlbGVtZW50VHlwZVwiOiBcImdlb21ldHJ5LmZpbGxcIixcclxuICAgICAgICAgICAgICAgIFwic3R5bGVyc1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBcImNvbG9yXCI6IFwiI2ZmODAwMFwiXHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIFwiZmVhdHVyZVR5cGVcIjogXCJyb2FkLmxvY2FsXCIsXHJcbiAgICAgICAgICAgICAgICBcImVsZW1lbnRUeXBlXCI6IFwiZ2VvbWV0cnkuZmlsbFwiLFxyXG4gICAgICAgICAgICAgICAgXCJzdHlsZXJzXCI6IFtcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwiY29sb3JcIjogXCIjY2ZiYjUyXCJcclxuICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwibGlnaHRuZXNzXCI6IDVcclxuICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwid2VpZ2h0XCI6IDRcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcInRyYW5zaXQuc3RhdGlvbi5idXNcIixcclxuICAgICAgICAgICAgICAgIFwiZWxlbWVudFR5cGVcIjogXCJnZW9tZXRyeVwiLFxyXG4gICAgICAgICAgICAgICAgXCJzdHlsZXJzXCI6IFtcclxuICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIFwiY29sb3JcIjogXCIjODBmZjAwXCJcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJmZWF0dXJlVHlwZVwiOiBcInRyYW5zaXQuc3RhdGlvbi5idXNcIixcclxuICAgICAgICAgICAgICAgIFwiZWxlbWVudFR5cGVcIjogXCJnZW9tZXRyeS5maWxsXCIsXHJcbiAgICAgICAgICAgICAgICBcInN0eWxlcnNcIjogW1xyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJjb2xvclwiOiBcIiMwMDAwMDBcIlxyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBcImZlYXR1cmVUeXBlXCI6IFwidHJhbnNpdC5zdGF0aW9uLnJhaWxcIixcclxuICAgICAgICAgICAgICAgIFwiZWxlbWVudFR5cGVcIjogXCJnZW9tZXRyeS5maWxsXCIsXHJcbiAgICAgICAgICAgICAgICBcInN0eWxlcnNcIjogW1xyXG4gICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJjb2xvclwiOiBcIiMwMDAwMDBcIlxyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgICAgfVxyXG5cdFx0XHQgXSxcclxuXHRcdFx0IHtuYW1lOiAnU3R5bGVkIE1hcCd9KTtcclxuXHJcbiB2YXIgbWFwID0gbmV3IGdvb2dsZS5tYXBzLk1hcChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbWFwJyksIHtcclxuXHQgem9vbTogMTksXHJcblx0IGNlbnRlcjoge2xhdDogNDUuNDgxMDg4NTAwMDAwMDEsIGxuZzogOS4yMDg4ODYzOTk5OTk5ODN9XHJcbiB9KTtcclxuXHJcblx0IG1hcC5tYXBUeXBlcy5zZXQoJ3N0eWxlZF9tYXAnLCBzdHlsZWRNYXBUeXBlKTtcclxuXHQgbWFwLnNldE1hcFR5cGVJZCgnc3R5bGVkX21hcCcpXHJcblxyXG4gICB2YXIgaW1hZ2UgPSAnaHR0cDovL3d3dy5hcnRlbmEuZXUvdGVzdC93cC1jb250ZW50L3RoZW1lcy9Gb3VuZGF0aW9uUHJlc3MvYXNzZXRzL2ltYWdlcy9tYXJrZXIucG5nJztcclxuICAgICB2YXIgYmVhY2hNYXJrZXIgPSBuZXcgZ29vZ2xlLm1hcHMuTWFya2VyKHtcclxuICAgICAgIHBvc2l0aW9uOiB7bGF0OiA0NS40ODEwODg1MDAwMDAwMSwgbG5nOiA5LjIwODg4NjM5OTk5OTk4M30sXHJcbiAgICAgICBtYXA6IG1hcCxcclxuICAgICAgIGljb246IGltYWdlXHJcbiAgICAgfSk7XHJcbi8qIG1hcmtlciA9IG5ldyBnb29nbGUubWFwcy5NYXJrZXIoe1xyXG5cdCBtYXA6IG1hcCxcclxuXHQgZHJhZ2dhYmxlOiBmYWxzZSxcclxuXHQgYW5pbWF0aW9uOiBnb29nbGUubWFwcy5BbmltYXRpb24uRFJPUCxcclxuXHQgdGl0bGU6ICdBcmdlbnRhcmlhJyxcclxuXHQgcG9zaXRpb246IHtsYXQ6IDQ1LjQ4MTA4ODUwMDAwMDAxLCBsbmc6IDkuMjA4ODg2Mzk5OTk5OTgzfVxyXG5cclxuXHJcbiB9KTtcclxuIG1hcmtlci5hZGRMaXN0ZW5lcignY2xpY2snLCB0b2dnbGVCb3VuY2UpOyovXHJcbn1cclxuXHJcblxyXG5cclxuXHJcbi8qZnVuY3Rpb24gdG9nZ2xlQm91bmNlKCkge1xyXG5pZiAobWFya2VyLmdldEFuaW1hdGlvbigpICE9PSBudWxsKSB7XHJcbm1hcmtlci5zZXRBbmltYXRpb24obnVsbCk7XHJcbn0gZWxzZSB7XHJcbm1hcmtlci5zZXRBbmltYXRpb24oZ29vZ2xlLm1hcHMuQW5pbWF0aW9uLkJPVU5DRSk7XHJcbn1cclxufSovXHJcbiIsImpRdWVyeShkb2N1bWVudCkuZm91bmRhdGlvbigpO1xyXG4iLCIvLyBKb3lyaWRlIGRlbW9cclxualF1ZXJ5KCcjc3RhcnQtanInKS5vbignY2xpY2snLCBmdW5jdGlvbigpIHtcclxuICBqUXVlcnkoZG9jdW1lbnQpLmZvdW5kYXRpb24oJ2pveXJpZGUnLCdzdGFydCcpO1xyXG59KTsiLCJqUXVlcnkoZG9jdW1lbnQpLnJlYWR5KGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciB2aWRlb3MgPSBqUXVlcnkoJ2lmcmFtZVtzcmMqPVwidmltZW8uY29tXCJdLCBpZnJhbWVbc3JjKj1cInlvdXR1YmUuY29tXCJdJyk7XHJcblxyXG4gICAgdmlkZW9zLmVhY2goZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciBlbCA9IGpRdWVyeSh0aGlzKTtcclxuICAgICAgICBlbC53cmFwKCc8ZGl2IGNsYXNzPVwicmVzcG9uc2l2ZS1lbWJlZCB3aWRlc2NyZWVuXCIvPicpO1xyXG4gICAgfSk7XHJcbn0pO1xyXG4iLCJcclxualF1ZXJ5KHdpbmRvdykuYmluZCgnIGxvYWQgcmVzaXplIG9yaWVudGF0aW9uQ2hhbmdlICcsIGZ1bmN0aW9uICgpIHtcclxuICAgdmFyIGZvb3RlciA9IGpRdWVyeShcIiNmb290ZXItY29udGFpbmVyXCIpO1xyXG4gICB2YXIgcG9zID0gZm9vdGVyLnBvc2l0aW9uKCk7XHJcbiAgIHZhciBoZWlnaHQgPSBqUXVlcnkod2luZG93KS5oZWlnaHQoKTtcclxuICAgaGVpZ2h0ID0gaGVpZ2h0IC0gcG9zLnRvcDtcclxuICAgaGVpZ2h0ID0gaGVpZ2h0IC0gZm9vdGVyLmhlaWdodCgpIC0xO1xyXG5cclxuICAgZnVuY3Rpb24gc3RpY2t5Rm9vdGVyKCkge1xyXG4gICAgIGZvb3Rlci5jc3Moe1xyXG4gICAgICAgICAnbWFyZ2luLXRvcCc6IGhlaWdodCArICdweCdcclxuICAgICB9KTtcclxuICAgfVxyXG5cclxuICAgaWYgKGhlaWdodCA+IDApIHtcclxuICAgICBzdGlja3lGb290ZXIoKTtcclxuICAgfVxyXG59KTtcclxuIl19
