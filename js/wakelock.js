/* ############################################################################
---------------------------------- Wake Lock ----------------------------------
############################################################################ */

// initialization : wake lock sentinel
let wakeLock = null;

if ('wakeLock' in navigator) {
  console.log("// Screen Wake Lock API supported 🎉");
}

document.addEventListener('visibilitychange', async () => {
  if (wakeLock !== null && document.visibilityState === 'visible') {
    wakeLock = await navigator.wakeLock.request('screen');
  }
});

/**
 * Request the screen to stay awake
 */
export const requestWakeLock = async () => {
  console.log('wakeLock requested');
  try {
    // initialization : wake lock sentinel
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      console.log('Screen Wake Lock released:', wakeLock.released);
    });
    console.log('Screen Wake Lock released:', wakeLock.released);
  } catch (err) {
    console.error(err);
  }
};