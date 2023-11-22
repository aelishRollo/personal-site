import React, { useState } from 'react';
import supabase from '../utils/supabaseClient';

interface CreateButtonProps {
  onTodoCreated: (newTodo: TodoType) => void;
}

type TodoType = {
  id?: number;
  name: string;
  urgent?: boolean;
  important?: boolean;
  parent_id?: number;
};

const CreateButton: React.FC<CreateButtonProps> = ({ onTodoCreated }) => {
  const [showForm, setShowForm] = useState(false);
  const [oof, setOof] = useState<TodoType>({
    name: '',
    urgent: false,
    important: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
  
    if (type === 'checkbox') {
      const checkbox = e.target as HTMLInputElement; // Type assertion
      setOof({ ...oof, [name]: checkbox.checked });
    } else {
      setOof({ ...oof, [name]: value });
    }
  };
  

  const handleSubmit = async () => {
    // Perform the insert into the database
    const { data, error } = await supabase.from('todos').insert([oof]);
    setShowForm(false)

    if (error) {
      console.error('Error inserting data:', error);
    } else if (data) {
      // Call the onTodoCreated prop with the new todo item
      onTodoCreated(data[0]);
      setShowForm(false); // Hide form after creation
    }
  };

  return (
    <div>
      {showForm ? (
        <form onSubmit={(e) => e.preventDefault()}>
          <div>
            <label htmlFor="name">Name:</label>
            <input
              type="text"
              id="name"
              name="name"
              value={oof.name}
              onChange={handleChange}
            />
          </div>
          <div>
            <label htmlFor="urgent">Urgent:</label>
            <input
              type="checkbox"
              id="urgent"
              name="urgent"
              checked={oof.urgent}
              onChange={handleChange}
            />
          </div>
          <div>
            <label htmlFor="important">Important:</label>
            <input
              type="checkbox"
              id="important"
              name="important"
              checked={oof.important}
              onChange={handleChange}
            />
          </div>
          <button onClick={handleSubmit}>Confirm</button>
        </form>
      ) : (
        <button onClick={() => setShowForm(true)}>Create</button>
      )}

      {/* Render the 'oof' variable inside a <p> */}
      <p>
        'oof' variable:
        <pre>{JSON.stringify(oof, null, 2)}</pre>
      </p>
    </div>
  );
};

export default CreateButton;
