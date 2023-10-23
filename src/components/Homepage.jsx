import Lank from './Lank'
import { Routes, Route, BrowserRouter, Link } from 'react-router-dom';


export default function HomePage() {
    return (
      <header className='App-header'>
        <h1 className='App-subheader'>  
          Alec Rollison
        </h1>
        <h3 className='App-subheader'>
          Me in 10 seconds
        </h3>
        <p className='App-paragraph'>
          I'm a musician. I sing, play guitar, keys and drums. I also mix my own music. I'm a nerd for music theory,
          but above all else, I love to improvise. 
        </p>
        <p className='App-paragraph'>
          I'm a web developer. I'm currently using node.js with typescript and React. I'm in favor of test driven development. 
          Also, I think it's beautiful that with some basic programming knowledge, we have the power to create new tools for anything we 
          dream up.
        </p>
        <Lank />
        <h3 className='App-subheader'>
          Contact Me
        </h3>
        <p className='App-paragraph'>
        I love meeting new people, and I reply to every email, so <Link to="/Contact"> say hello </Link>.
        </p>
        
      </header>
    );
  }
