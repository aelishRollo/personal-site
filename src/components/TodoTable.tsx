import React, { useState, useEffect } from 'react';
import supabase from '../utils/supabaseClient';

// Define your data type
type TodoType = {
  id: number;
  name: string;
  urgent?: boolean;
  important?: boolean;
  parent_id?: number;
};

const TodoList: React.FC = () => {
  // State to hold todos
  const [todos, setTodos] = useState<TodoType[]>([]);

  // Function to fetch todos from the database
  const fetchTodos = async () => {
    let { data: todos, error } = await supabase
      .from('todos') 
      .select('*');

    if (error) console.log('error', error);
    else setTodos(todos || []);
  };

  // Fetch todos on component mount
  useEffect(() => {
    fetchTodos();
  }, []);

  // Render the todos in a list
  return (
    <div>
      <h1>Todo List</h1>
      <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
        {todos.map((todo) => (
          <li key={todo.id} style={{ marginBottom: '0.5rem', borderLeft: '2px solid #ccc', paddingLeft: '1em' }}>
            <div style={{ fontWeight: todo.urgent ? 'bold' : 'normal', textDecoration: todo.important ? 'underline' : 'none' }}>
              {todo.name}
              {todo.important && <span style={{ color: 'red', marginLeft: '0.5em' }}>Important</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TodoList;
