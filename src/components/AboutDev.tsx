import '../App.css';
import HomeButton from './HomeButton';

export default function Contact() {

    return (
        <div className="App">
            <header className="App-header">
                <HomeButton />
                <h4>My Current Technologies</h4>
                <p className='App-paragraph'>
                    Right now I'm mainly using node.js with typescript and React. I've been using Supabase as a backend and having a good
                    expereince with that.
                </p>
                <h4>Personal Philosophies</h4>
                <p className='App-paragraph'>
                    I'm in favor of <a href='https://en.wikipedia.org/wiki/Test-driven_development' target='_blank'> test driven development</a>,
                    as well as Typescript over vanilla Javascript because in any
                    serious application I think the more maintainible, robust, and mature the codebase is, the better.

                </p>
                <p className='App-paragraph'>
                    Also, I think it's beautiful that with some knowledge and hard work, we have the power to create new tools and technologies for
                    anything we can think of. Unlike creators of most technolgies, our work does not require physical materials. It's honestly
                    quite beautiful.
                </p>
            </header >
        </div >

    );
}
