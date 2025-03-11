import { mount } from 'svelte';
import App from './App.svelte';


// Svelte 5 uses mount instead of new constructor
mount(App, {
    target: document.getElementById('app')!
});
// No export needed 