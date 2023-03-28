import React, { memo, useContext, useEffect, useState } from 'react';
import Plus from '@strapi/icons/Plus';
import Trash from '@strapi/icons/Trash';
import { IconButton } from '@strapi/design-system/IconButton';
import { Box } from '@strapi/design-system/Box';
import { Table, Thead, Tbody, Tr, Td, Th, TFooter } from '@strapi/design-system/Table';
import { Typography } from '@strapi/design-system/Typography';
import { TextInput } from '@strapi/design-system/TextInput';
import { MappingContext } from '../../pages/Mapping/mappingcontext';

const MappingCharacteristics = ({ key, characteristic }) => {
    const [importMapping, setImportMapping] = useContext(MappingContext)
    const [name, setName] = useState(characteristic.name)
    const [value, setValue] = useState(characteristic.value)

    useEffect(() => {

        updateCharNameMapping(characteristic.id)

    }, [name, value])

    const updateCharNameMapping = (id) => {
        let new_map = importMapping.char_value_map.map((item) => {
            if (item.id === id) {
                item.name = name,
                    item.value = value
            }
            return item
        })
        setImportMapping({ ...importMapping, char_value_map: new_map })
    }

    const handleDeleteCharValue = () => {
        let new_map = importMapping.char_value_map.filter(item => item.id !== characteristic.id)

        setImportMapping({ ...importMapping, char_value_map: new_map })

    }

    return (
        <>
            <Td  aria-colindex={1}>
                <TextInput
                    name={name}
                    value={name}
                    label="Όνομα χαρακτηριστικού στο αρχείο"
                    onChange={(e) => setName(e.target.value)}
                />
            </Td>
            <Td  aria-colindex={2}>
                <TextInput
                    name={value}
                    value={value}
                    label="Όνομα χαρακτηριστικού στη βάση"
                    onChange={(e) => setValue(e.target.value)}
                />
            </Td>
            <Td  aria-colindex={3}>
                <IconButton noBorder onClick={() => handleDeleteCharValue()} label="Delete" icon={<Trash />} />
            </Td>
        </>
    )
}

const MappingCharValue = ({ mapping }) => {
    const [importMapping, setImportMapping] = useContext(MappingContext)
    const [newID, setNewID] = useState(1)

    const handleAddCharTitle = () => {
        let new_map = {
            id: `newID-${newID}`,
            name: '',
            value: ''
        }

        setNewID(newID + 1)
        let new_char_value_map = [...importMapping.char_value_map, new_map]
        setImportMapping({ ...importMapping, char_value_map: new_char_value_map })
    }

    return (
        <Box padding={4} background="neutral100">
            <Table colCount={3} rowCount={20}
                footer={<TFooter icon={<Plus />} onClick={() => handleAddCharTitle()}>Add another field to this collection type</TFooter>}>
                <Thead>
                    <Tr>
                        <Th>
                            <Typography variant="sigma">Όνομα στο αρχείο</Typography>
                        </Th>
                        <Th>
                            <Typography variant="sigma">Όνομα στη βάση</Typography>
                        </Th>
                        <Th>
                            <Typography variant="sigma">Ενέργεια</Typography>
                        </Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {mapping.length > 0 && mapping.map(item =>
                        <Tr key={item.id}>
                            <MappingCharacteristics characteristic={item} />
                        </Tr>
                    )}
                </Tbody>
            </Table>
        </Box>
    )

}

export default MappingCharValue