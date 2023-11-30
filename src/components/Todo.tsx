import { useState } from 'react';
import '../App.css';
import ViewTodoList from './ViewTodoList';
import RenderCreateButton from './RenderCreateButton'
import RenderSpecificTodo from './RenderSpecificTodo';


export default function App() {

    
    let [isVisible,setIsVisible] = useState(false)
    const handleButtonClick = () => {   
        setIsVisible(!isVisible)    //change isVisible's value
    }

    return (
        <div className="App-header">
            <RenderCreateButton />
            <RenderSpecificTodo isVisible={isVisible} setIsVisible={setIsVisible} handleButtonClick={handleButtonClick}/>
            <ViewTodoList />
        </div>
    );
}
