/* ============================================================
 * demo-shim.js
 * ------------------------------------------------------------
 * Makes a study site run as a self-contained demonstration,
 * with no backend server.
 *
 * Background
 * ----------
 * The sites originally asked https://mktresearch.co/php/... which
 * navigation condition to show. That server no longer exists.
 *
 * There is also a fault in the original code of three of the four
 * projects: the request is written as
 *     uni.$post('getcondition', params)
 * but `params` is never declared at that point, so the call raises
 * an error before anything is sent. The condition was therefore
 * never applied through that path, even while the server was alive.
 *
 * How this file works around it
 * -----------------------------
 * The apps read a saved session from browser storage under the key
 * "save_01". When that record exists, they take the condition from
 * it and skip the network entirely. So instead of repairing the
 * broken request, this file writes that record before the app
 * starts, using the condition given in the page address.
 *
 * Any leftover network calls are also pointed at small local JSON
 * files, so nothing tries to reach the dead server.
 *
 * Choosing a condition
 * --------------------
 *   index.html?c=2#/     vertical, finger gesture
 *   index.html?c=0#/     horizontal, finger gesture
 *
 *   0  horizontal + swipe gesture
 *   1  horizontal + tap buttons
 *   2  vertical + scroll gesture
 *   3  vertical + tap buttons
 *
 * Defaults to 2 when nothing is given.
 * ============================================================ */
(function () {
  'use strict';

  var DEFAULT_CONDITION = 2;
  var BACKEND_MARKER = 'mktresearch.co';
  var STORAGE_KEY = 'save_01';

  // ----------------------------------------------------------
  // Which condition was asked for in the address? The check
  // allows it before or after the # part, because the app uses
  // hash based routing and the two can appear in either order.
  // ----------------------------------------------------------
  function readCondition() {
    var m = window.location.href.match(/[?&](?:c|condition)=([0-3])(?:\D|$)/);
    return m ? Number(m[1]) : DEFAULT_CONDITION;
  }

  var condition = readCondition();

  // ----------------------------------------------------------
  // Clear everything the app remembers between visits.
  //
  // All five demonstrations sit on one web address, so they share
  // the same browser storage. Without this, a cart filled in one
  // study reappears in another, and the badge on the photo studies
  // shows a count left over from the shopping task while the
  // collection itself is empty.
  //
  // save_01           session record, including the condition
  // shop_card         cart contents
  // shoppingCardList  cart contents, second copy
  // user_commdity     items the participant chose
  // love_list         liked photographs
  // statistics        interaction log
  // statisticsALineList  interaction log, pending batch
  // now_countdown     timer state
  // ----------------------------------------------------------
  var APP_KEYS = [
    'save_01', 'shop_card', 'shoppingCardList', 'user_commdity',
    'love_list', 'statistics', 'statisticsALineList', 'now_countdown',
  ];

  try {
    // Remove the known keys, and any variant that carries a suffix.
    var doomed = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (!key) continue;
      for (var k = 0; k < APP_KEYS.length; k++) {
        if (key === APP_KEYS[k] || key.indexOf(APP_KEYS[k]) !== -1) {
          doomed.push(key);
          break;
        }
      }
    }
    doomed.forEach(function (key) { localStorage.removeItem(key); });
  } catch (e) {
    console.warn('[demo] could not clear previous session:', e);
  }

  // ----------------------------------------------------------
  // Write the session record the app expects.
  //
  // uni-app stores values as {"type":"object","data":{...}}, so the
  // record has to be wrapped the same way or the app will not
  // recognise it. Writing it fresh on every load means the address
  // always decides the condition.
  // ----------------------------------------------------------
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        type: 'object',
        data: {
          _id: 'demo-' + Date.now(),
          condition: condition,
        },
      })
    );
  } catch (e) {
    console.warn('[demo] could not write session record:', e);
  }

  // ----------------------------------------------------------
  // Point any remaining backend calls at local files, so nothing
  // waits on a server that is not there.
  // ----------------------------------------------------------
  var basePath = window.location.pathname.replace(/[^/]*$/, '');

  function localFileFor(url) {
    if (url.indexOf('getcondition') !== -1) {
      return basePath + 'api/condition-' + condition + '.json';
    }
    return basePath + 'api/ok.json'; // logging calls: accept and discard
  }

  function isBackendCall(url) {
    return typeof url === 'string' && url.indexOf(BACKEND_MARKER) !== -1;
  }

  // The method is switched to GET because static hosting will not
  // accept POST for a plain file.
  var open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    if (isBackendCall(url)) {
      var rest = Array.prototype.slice.call(arguments, 2);
      return open.apply(this, ['GET', localFileFor(url)].concat(rest));
    }
    return open.apply(this, arguments);
  };

  if (window.fetch) {
    var nativeFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      if (!isBackendCall(url)) return nativeFetch(input, init);
      return nativeFetch(localFileFor(url), { method: 'GET' });
    };
  }

  var layout = condition === 0 || condition === 1 ? 'horizontal' : 'vertical';
  var control = condition === 0 || condition === 2 ? 'gesture' : 'buttons';
  console.log('[demo] condition ' + condition + ': ' + layout + ', ' + control);
})();
