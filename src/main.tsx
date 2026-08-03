import "./native.js";
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './premium-experience.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="oc-experience" data-app="on-call">
      <App />
    </div>
  </React.StrictMode>,
)
