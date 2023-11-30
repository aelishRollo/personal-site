import { useState } from 'react';
import '../App.css';
import ViewTodoList from './ViewTodoList';
import RenderCreateButton from './RenderCreateButton'
import RenderSpecificTodo from './RenderSpecificTodo';


type TodoType = {   
    id: number;
    name: string;
    urgent: boolean | null;
    important: boolean | null;
};


type TodoInputType = {
  name: string;
  urgent?: boolean;
  important?: boolean;
  parent_id?: number;
};

type TodoFormProps = {
    addTodo: (todo: TodoType) => void;
}



type TodoListProps = {
    todos: TodoType[];
    deleteMode: boolean;
    toDelete: number[];
    toggleDelete: (id: number) => void;
};


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
