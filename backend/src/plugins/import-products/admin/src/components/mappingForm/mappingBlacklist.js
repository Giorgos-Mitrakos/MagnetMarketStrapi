import React, { memo, useContext, useEffect, useState } from 'react';
// import PropTypes from 'prop-types';
import pluginId from '../../pluginId';

import { Accordion, AccordionToggle, AccordionContent, AccordionGroup } from '@strapi/design-system/Accordion';
import Plus from '@strapi/icons/Plus';
import Trash from '@strapi/icons/Trash';
import { IconButton } from '@strapi/design-system/IconButton';
import { Box } from '@strapi/design-system/Box';
import { TextButton } from '@strapi/design-system/TextButton';
import { Flex } from '@strapi/design-system/Flex';
import { Tooltip } from '@strapi/design-system/Tooltip';
import { Stack } from '@strapi/design-system/Stack';
import { TextInput } from '@strapi/design-system/TextInput';
import Information from '@strapi/icons/Information';
import { MappingContext } from '../../pages/Mapping/mappingcontext';

const AccordionForm = ({ label, cat }) => {
    const [expanded, setExpanded] = useState(false);
    const [importMapping, setImportMapping] = useContext(MappingContext)
    const [name, setName] = useState(cat.name);


    useEffect(() => {
        updateWhitelistMapping(cat.id)
    }, [name])

    const handleDeleteCategoryClick = (id) => {
        let new_map = []
        switch (label) {
            case "Κατηγορία":
                new_map = importMapping.blacklist_map.filter(item => item.id !== id)
                break;
            case "Υποκατηγορία":
                new_map = importMapping.blacklist_map.map(item => {
                    item.subcategory = item.subcategory.filter(subItem => subItem.id !== id)
                    return item
                })
                break;
            case "Υποκατηγορία2":
                new_map = importMapping.blacklist_map.map(item => {
                    item.subcategory = item.subcategory.map(subItem => {
                        subItem.subcategory = subItem.subcategory.filter(subItem2 => subItem2.id !== id)
                        return subItem
                    })
                    return item
                })
                break;
            default:
                break;
        }

        setImportMapping({ ...importMapping, blacklist_map: new_map })
    }

    const handleOnChangeCategoryName = (e) => {
        setName(e.target.value)
    }

    const updateWhitelistMapping = (id) => {
        let new_map = []
        switch (label) {
            case "Κατηγορία":
                new_map = importMapping.blacklist_map.map(item => {
                    if (item.id === id) {
                        item.name = name
                    }
                    return item
                })
                break;
            case "Υποκατηγορία":
                new_map = importMapping.blacklist_map.map(item => {
                    item.subcategory = item.subcategory.map(subItem => {
                        if (subItem.id === id) {
                            subItem.name = name
                        }
                        return subItem
                    })
                    return item
                })
                break;
            case "Υποκατηγορία2":
                new_map = importMapping.blacklist_map.map(item => {
                    item.subcategory = item.subcategory.map(subItem => {
                        subItem.subcategory = subItem.subcategory.map(subItem2 => {
                            if (subItem2.id === id) {
                                subItem2.name = name
                            }
                            return subItem2
                        })
                        return subItem
                    })
                    return item
                })
                break;
            default:
                break;
        }

        setImportMapping({ ...importMapping, blacklist_map: new_map })
    }

    return (
        <Accordion expanded={expanded} onToggle={() => setExpanded(!expanded)}>
            <AccordionToggle
                action={<Stack horizontal spacing={0}>
                    <IconButton noBorder label="Delete"
                        onClick={() => handleDeleteCategoryClick(cat.id)}
                        icon={<Trash />} />
                </Stack>}
                title={name}
                togglePosition="left" />
            <AccordionContent padding={2}>
                <TextInput
                    name={name}
                    value={name}
                    label="Όνομα Κατηγορίας"
                    onChange={(e) => handleOnChangeCategoryName(e, cat.id)}
                />
                <MappingBlacklist
                    label={label === "Κατηγορία" ? "Υποκατηγορία" :
                        label === "Υποκατηγορία" ? "Υποκατηγορία2" : null} mapping={cat.subcategory} categoryID={cat.id} />

            </AccordionContent>
        </Accordion>
    )
}

const MappingBlacklist = ({ label, mapping, categoryID }) => {

    const [importMapping, setImportMapping] = useContext(MappingContext)
    const [tempId, setTempId] = useState(1);

    const handleCategoryClick = () => {
        let tempArray = []
        let findCategory = []
        switch (label) {
            case "Κατηγορία":
                tempArray = [...importMapping.blacklist_map, { id: `tempId-${tempId}`, name: "", subcategory: [] }];
                setImportMapping({ ...importMapping, blacklist_map: tempArray })
                break;
            case "Υποκατηγορία":
                findCategory = importMapping.blacklist_map.map(item => {
                    if (item.id === categoryID) {
                        item.subcategory = [...item.subcategory, { id: `tempId-${categoryID}-${tempId}`, name: "", subcategory: [] }]
                    }
                    return item
                })
                setImportMapping({ ...importMapping, blacklist_map: findCategory })

                break;
            case "Υποκατηγορία2":
                findCategory = importMapping.blacklist_map.map(item => {
                    item.subcategory.map(subItem => {
                        if (subItem.id === categoryID) {
                            subItem.subcategory = [...subItem.subcategory, { id: `tempId-${categoryID}-${tempId}`, name: "", subcategory: [] }]
                        }
                    })

                    return item
                })
                setImportMapping({ ...importMapping, blacklist_map: findCategory })
                break;
            default:
                break;
        }

        setTempId(tempId + 1)

    }

    return (
        <Box padding={4}>
            <AccordionGroup paddingTop={6} error=""
                footer={label !== null && <Flex justifyContent="center" height="48px" background="neutral150">
                    <TextButton startIcon={<Plus />} onClick={handleCategoryClick}>
                        Add an entry
                    </TextButton>
                </Flex>}
                label={label}
                labelAction={<Tooltip description="Πρόσθεσε τις κατηγορίες και τις υποκατηγορίες τους που
                θέλεις να περιληφθούν στην εισαγωγή των προϊόντων. Αν είναι κενή τότε θα συμπεριληφθούν
                όλες οι κατηγορίες με τις υποκατηγορίες τους. Αν συμπλήρωθεί η κατηγορία τότε 
                θα συμπεριληφθούν και όλες οι υποκατηγορίες τους εκτός και συμπληρωθούν συγκεκριμένες
                υποκατηγορίες οπότε θα συμπεριληφθούν μόνο αυτές.">
                    <button aria-label="Πληροφορίες για τη whitelist."
                        style={{
                            border: 'none',
                            padding: 0,
                            background: 'transparent'
                        }}><Information aria-hidden={true} />
                    </button>
                </Tooltip>}>
                {mapping ?
                    mapping.map(x =>
                        <AccordionForm label={label} key={x.id} cat={x} />) :
                    <Accordion >
                        <AccordionContent>
                            <TextInput
                                name=""
                                value=""
                                label={label}
                            />
                        </AccordionContent>
                    </Accordion>}
            </AccordionGroup>
        </Box >
    )
}

export default memo(MappingBlacklist);