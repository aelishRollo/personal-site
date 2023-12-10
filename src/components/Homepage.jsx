import { Link } from 'react-router-dom';

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
          I'm a <Link to="/AboutMusic"> musician</Link>. 
         
        </p>
        <p className='App-paragraph'>
        I'm also a <Link to="/AboutDev">web</Link> <Link to="/AboutDev">developer. </Link>
        </p>
        <p className='App-paragraph'>
        Try out (demo) <Link to="/Todo-test">one of my projects</Link>
        </p>
        <h3 className='App-subheader'>
          Contact Me
        </h3>
        <p className='App-paragraph'>
        I love meeting new people, and I reply to every email, so <Link to="/Contact"> say hello </Link>.
        </p>
        
        
      </header>
    );
  }
