import { useState, useEffect } from 'react';
import supabase from '../utils/supabaseClient';
import '../App.css';
import ViewTodoList from './ViewTodoList';
import RenderCreateButton from './RenderCreateButton';
import RenderSpecificTodo from './RenderSpecificTodo';


export default function App() {

    let [isVisible, setIsVisible] = useState(false)

    const handleButtonClick = () => {
        setIsVisible(!isVisible)    //change isVisible's value
    }

    const handleCellClick = (todo: TodoType) => {
        console.log(todo);
    };


    type TodoType = {
        id: number;
        name: string;
        urgent?: boolean;
        important?: boolean;
        parent_id?: number;
    };


    const [todos, setTodos] = useState<TodoType[]>([]);

    const fetchTodos = async () => {
        let { data: todos, error } = await supabase
            .from('todos')
            .select('*');

        if (error) console.log('error', error);
        else setTodos(todos || []);
    };

    useEffect(() => {
        fetchTodos();
    }, []);

    let [currentTodo, setCurrentTodo] = useState(todos[3])      //arbitrary inital value to make compiler happy


    function SingleTodo() {
        let result = <> </>
        let todoIsVisible = isVisible
        if (todoIsVisible) {            //if isVisible, render the table
            result = <div>
                <h3> Todo Item you clicked on</h3>
                <table className='TodoTable' onClick={handleButtonClick} >
                    <tbody>
                        <tr>
                            <th>{currentTodo.name}</th>
                            <th>{currentTodo.urgent}</th>
                            <th>{currentTodo.important}</th>
                            <th>{currentTodo.parent_id}</th>
                        </tr>

                    </tbody>
                </table>
                <h1>{JSON.stringify(currentTodo)}</h1>
            </div>
        }
        else {
            result = <> </>
        }

        return (
            result
        )
    };

    const IsVisibleController = () => {
        let result = <SingleTodo />
        if (isVisible) {
            result = <SingleTodo />
        } else {
            result = <div>
                <RenderCreateButton />
                <ViewTodoList isVisible={isVisible} setIsVisible={setIsVisible} 
                handleButtonClick={handleButtonClick} todos={todos} setCurrentTodo={setCurrentTodo} />
            </div>
        }

        return (
            <div>
                {result}
            </div>
        )
    }


    return (
        <div className="App-header">
            <IsVisibleController />
        </div>
    );
}
