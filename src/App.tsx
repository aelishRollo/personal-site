import React from 'react';
import logo from './logo.svg';
import './App.css';
import { Routes, Route, BrowserRouter, Link } from 'react-router-dom';
import Todo from './components/Todo';
import Navbar from './components/Navbar';
import Lank from './components/Lank';
import Joy from './components/Joy'

//does <Coco /> actually work though? Need to find out


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

function HomePage() {
  return (
    <header className="App-header">
      <img src={logo} className="App-logo" alt="logo" />
      <p>
         Hi, this is page Ronson!......
      </p>
      <Lank />
    </header>
  );
}



export default App;
