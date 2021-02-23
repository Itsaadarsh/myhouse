import React from 'react';
import { v1 as uuid } from 'uuid';

const CreateHouse = props => {
  const create = () => {
    const houseID = uuid();
    props.history.push(`/house/${houseID}`);
  };

  return <button onClick={create}>Create House</button>;
};

export default CreateHouse;
