import '../App.css';
import { Routes, Route, BrowserRouter, Link } from 'react-router-dom';
import supabase from '../utils/supabaseClient';

export default function test() {

    type TodoType = {   //will be deleted soon
        //id: number;
        name: string;
        urgent: boolean;
        important: boolean;
    };

    type TodoInputType = {
        name: string;
        urgent?: boolean;
        important?: boolean;
        parent_id?: number;
    };
    

    async function addTodoToDatabase(todo: TodoInputType): Promise<TodoType | null> { 
        const response: { data: TodoType[] | null, error: any } = await supabase
            .from('todos')
            .insert([todo]);
      
        if (response.error) {
            console.error("Error adding todo:", response.error);
            return null;
        }
      
        if (response.data && response.data.length > 0) {
            return response.data[0];
        } else {
            console.warn("No data returned from insert");
            return null;
        }
      }
      
      let sampleTodo: TodoType = {
        name: "simple sample todo",
        urgent: true,
        important: false
      }
      
  


    return (
        <div className="App">
            <header className="App-header">
                <p>
                I love meeting new people, and I reply to every email, so get my database working please.
                This should have added "simple sample todo" 
                </p>
            
            
            </header >
        </div>
               
        );
}
