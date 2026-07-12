(function () {
  'use strict';

  function noop() {}

  window.NSRoomsLiveV1 = {
    disabled: true,
    render: function () { return ''; },
    mount: noop,
    refresh: noop,
    reset: noop
  };
})();