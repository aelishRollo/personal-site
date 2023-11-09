import React, { useState, useEffect } from 'react';
import CreateButton from './CreateButton'; // Make sure this path is correct
import supabase from '../utils/supabaseClient';

// Reuse the TodoType definition from CreateButton or define it again if needed
type TodoType = {
  id?: number;
  name: string;
  urgent?: boolean;
  important?: boolean;
  parent_id?: number;
};

const ParentComponent: React.FC = () => {
  const [todos, setTodos] = useState<TodoType[]>([]);

  useEffect(() => {
    fetchTodos();
  }, []);

  // Function to fetch todos from the database
  const fetchTodos = async () => {
    let { data, error } = await supabase.from('todos').select('*');
    if (error) {
      console.error('Error fetching todos:', error);
      return;
    }
    setTodos(data || []);
  };

  const addTodoToList = (newTodo: TodoType) => {
    setTodos([...todos, newTodo]);
  };

  return (
    <div>
      <CreateButton onTodoCreated={addTodoToList} />
      <div>
        {todos.map((todo, index) => (
          <div key={todo.id || index}>{todo.name}</div> // Use the todo ID or index as a key
        ))}
      </div>
    </div>
  );
};

export default ParentComponent;
