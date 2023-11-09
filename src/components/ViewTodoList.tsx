import React, { useState, useEffect } from 'react';
import supabase from '../utils/supabaseClient';




type TodoType = {
  id: number;
  name: string;
  urgent?: boolean;
  important?: boolean;
  parent_id?: number;
};

const ViewTodoList: React.FC = () => {
  // State to hold todos
  const [todos, setTodos] = useState<TodoType[]>([]);

  // Function to fetch todos from the database
  const fetchTodos = async () => {
    let { data: todos, error } = await supabase
      .from('todos') // your table name
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
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>
            <div>
              {todo.name}
            </div>
            {todo.important && <div>Important</div>}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ViewTodoList;
