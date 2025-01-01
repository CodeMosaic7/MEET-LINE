import { useState } from 'react'
import ReactDOM from "react-dom/client"
import './App.css'
import {BrowserRouter, Routes, Route} from "react-router-dom"
import { Landing } from './components/Landing'
import { ChatRoom } from './components/ChatRoom'

function App() {
// usestate hook returns an array
  return (
    // <BrowserRouter>
    // <Routes>
      <Landing/>
      /* <Route path="ChatRoom" element={<ChatRoom/>}/>     */
    // </Routes>
    // </BrowserRouter>
  )
}

export default App
