import React, { memo, useContext, useEffect, useState } from 'react';
import Plus from '@strapi/icons/Plus';
import Trash from '@strapi/icons/Trash';
import { IconButton } from '@strapi/design-system/IconButton';
import { Box } from '@strapi/design-system/Box';
import { Flex } from '@strapi/design-system/Flex';
import { Table, Thead, Tbody, Tr, Td, Th, TFooter } from '@strapi/design-system/Table';
import { Typography } from '@strapi/design-system/Typography';
import { TextInput } from '@strapi/design-system/TextInput';
import { MappingContext } from '../../pages/Mapping/mappingcontext';

const MappingValues = ({ stockValues }) => {
    const [importMapping, setImportMapping] = useContext(MappingContext)
    const [name, setName] = useState(stockValues.name)

    useEffect(() => {

        updateStockMapping(stockValues.id)

    }, [name])

    const updateStockMapping = (id) => {
        let new_map = importMapping.stock_map.map((item) => {
            if (item.id === id) {
                item.name = name
            }
            return item
        })
        setImportMapping({ ...importMapping, stock_map: new_map })
    }

    const handleDeleteStock = () => {
        let new_map = importMapping.stock_map.filter(item => item.id !== stockValues.id)

        setImportMapping({ ...importMapping, stock_map: new_map })

    }

    return (
        <Tr>

            <Td>
                <Box padding={2}>
                    <TextInput
                        name={name}
                        value={name}
                        label="Όνομα στο αρχείο"
                        onChange={(e) => setName(e.target.value)}
                    />
                </Box>
            </Td>
            <Td>
                <IconButton noBorder onClick={() => handleDeleteStock()} label="Delete" icon={<Trash />} />
            </Td>

        </Tr >
    )
}

const MappingStock = () => {
    const [importMapping, setImportMapping] = useContext(MappingContext)
    const [newID, setNewID] = useState(1)

    const handleAddStockValue = () => {
        let new_map = {
            id: `newID-${newID}`,
            name: ''
        }

        setNewID(newID + 1)
        let new_stock_map = [...importMapping.stock_map, new_map]
        setImportMapping({ ...importMapping, stock_map: new_stock_map })
    }

    return (
        <Box padding={4} background="neutral100">
            <Table colCount={2} rowCount={20}
                footer={<TFooter icon={<Plus />} onClick={() => handleAddStockValue()}>Add another field to this collection type</TFooter>}>
                <Thead>
                    <Tr>
                        <Th>
                            <Typography variant="sigma">Όνομα στο αρχείο</Typography>
                        </Th>
                        <Th>
                            <Typography variant="sigma">Ενέργεια</Typography>
                        </Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {importMapping.stock_map.length > 0 && importMapping.stock_map.map(item =>
                        <MappingValues key={item.id} stockValues={item} />
                    )}
                </Tbody>
            </Table>
        </Box>
    )

}

export default MappingStock