import React, { memo, useContext, useEffect, useState } from 'react';
// import PropTypes from 'prop-types';
import pluginId from '../../pluginId';

import { Accordion, AccordionToggle, AccordionContent, AccordionGroup } from '@strapi/design-system/Accordion';
import Plus from '@strapi/icons/Plus';
import { Box } from '@strapi/design-system/Box';
import { TextButton } from '@strapi/design-system/TextButton';
import { Flex } from '@strapi/design-system/Flex';
import { Tooltip } from '@strapi/design-system/Tooltip';
import { Stack } from '@strapi/design-system/Stack';
import { TextInput } from '@strapi/design-system/TextInput';
import Information from '@strapi/icons/Information';
import MappingAccordion from './mappingAcordition'
import { MappingContext } from '../../pages/Mapping/mappingcontext';

const MappingForm = ({ label, mapping, categoryID }) => {

    const [importMapping, setImportMapping] = useContext(MappingContext)
    const [tempId, setTempId] = useState(1);

    const handleCategoryClick = () => {
        let tempArray = []
        let findCategory = []
        switch (label) {
            case "Κατηγορία":
                tempArray = [...importMapping.categories_map, { id: `tempId-${tempId}`, name: "", value: "", contains: [], subcategory: [] }];
                setImportMapping({ ...importMapping, categories_map: tempArray })
                break;
            case "Υποκατηγορία":
                findCategory = importMapping.categories_map.map(item => {
                    if (item.id === categoryID) {
                        item.subcategory = [...item.subcategory, { id: `tempId-${categoryID}-${tempId}`, name: "", value: "", contains: [], subcategory: [] }]
                    }
                    return item
                })
                setImportMapping({ ...importMapping, categories_map: findCategory })
                
                break;
            case "Υποκατηγορία2":
                 findCategory = importMapping.categories_map.map(item => {
                    item.subcategory.map(subItem => {
                        if (subItem.id === categoryID) {
                            subItem.subcategory = [...subItem.subcategory, { id: `tempId-${categoryID}-${tempId}`, name: "", value: "", contains: [], subcategory: [] }]
                        }
                    })

                    return item
                })
                setImportMapping({...importMapping,categories_map:findCategory})
                break;
            default:
                break;
        }

        setTempId(tempId + 1)

    }

    return (
        <Box padding={4}>
            <AccordionGroup paddingTop={6}  error=""
                footer={<Flex justifyContent="center" height="48px" background="neutral150">
                    <TextButton startIcon={<Plus />} onClick={handleCategoryClick}>
                        Add an entry
                    </TextButton>
                </Flex>}
                label={label}
                labelAction={<Tooltip description="Κάνε mapping τις κατηγορίες του αρχείου με τις αντίστοιχες του  site,
        σε περίπτωση που ή κατηγορία δεν είναι αρκετή μπορείς να χρησιμοποιήσεις κάποιο χαρακτηριστικό του ονόματος του προϊόντος σε συνδυασμό με την κατηγορία του προμηθευτή!">
                    <button aria-label="Πληροφορίες για το mapping των κατηγοριών."
                        style={{
                            border: 'none',
                            padding: 0,
                            background: 'transparent'
                        }}><Information aria-hidden={true} />
                    </button>
                </Tooltip>}>
                {mapping ? mapping.map(cat =>
                    <MappingAccordion key={cat.id} cat={cat} label={label} categoryID={cat.id} />) :
                    <Accordion>
                        <AccordionContent>
                            <Stack horizontal padding={6} spacing={6}>
                                <TextInput
                                    spacing={4}
                                    name=""
                                    value=""
                                    label="Φράση στο αρχείο"
                                />
                                <TextInput
                                    name=""
                                    value=""
                                    label="Μετάφραση σε κατηγορία" />
                            </Stack>
                        </AccordionContent>
                    </Accordion>}
            </AccordionGroup>
        </Box>
    )
}

export default memo(MappingForm);