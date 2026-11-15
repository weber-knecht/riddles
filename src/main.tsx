import { render } from 'preact'
import { App } from './app'
import { Bench } from './shell/Bench'
import { plugins } from './core/registry'
import './styles.css'

const root = document.getElementById('app')
// `?bench` opens the diagnostics page instead of the app.
const bench = new URLSearchParams(location.search).has('bench')
if (root) render(bench ? <Bench plugins={plugins} /> : <App />, root)
