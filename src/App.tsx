import React from 'react';
import logo from './logo.svg';
import './App.css';
import { Routes, Route, BrowserRouter, Link } from 'react-router-dom';
import Todo from './components/Todo';
import Navbar from './components/Navbar';
import Lank from './components/Lank';
import Joy from './components/Joy'
import HomePage from './components/Homepage';



function App() {
  return (
    <div className="App">
      <Navbar />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/Todo" element={<Todo />} />
          <Route path="/Coco" element={<Coco />} />
          <Route path="/Joy" element={<Joy />} />
          
        </Routes>
      </BrowserRouter>
    </div>
  );
}

function greet(name: string): string {
  return `This is a second, ${name}!`;
}

function Coco() {
  return (
    <div className="App">
         <header className="App-header">
            <p>{greet("Derek Farthing Jr.")}</p>
            <Lank />
         </header>
      </div>
  )
}




export default App;
