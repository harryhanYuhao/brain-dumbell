export const THEME_KEY = "brain-dumbell:theme";

// Runs in <head> before first paint so a saved choice never flashes the wrong theme.
export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
