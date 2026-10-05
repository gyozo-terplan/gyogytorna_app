// A modul/CDN hibája is látható legyen; 3D választásnál ne maradjon észrevétlen a 2D kép.
(function(){
  let loading = null, attempt = 0;
  window.player3dLoadState = 'loading';
  window.loadPlayer3D = function(){
    if(loading) return loading;
    window.player3dLoadState = 'loading';
    window.dispatchEvent(new Event('player3d-loading'));
    loading = import('./player3d.js?v=human-2&attempt=' + attempt++)
      .then(() => { window.player3dLoadState = 'ready'; })
      .catch(error => {
        window.player3dLoadState = 'failed';
        console.error('A 3D modul nem töltődött be:', error);
        window.dispatchEvent(new CustomEvent('player3d-failed', { detail: 'load' }));
      })
      .finally(() => { loading = null; });
    return loading;
  };
  window.loadPlayer3D();
})();
