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
          I'm a <Link to="/Music"> musician </Link>. I'm also a <Link to="/Webdev"> web developer </Link>
        </p>
        <p className='App-paragraph'>
          We will be the lightning that rides the storm.
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
